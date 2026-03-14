import { groupGamesByRound, indexTeams } from "@/lib/bracket";
import { BracketSubmission, ModelDefinition } from "@/lib/types";
import { ModelAdapter, PredictionInput } from "@/agents/interfaces";

function seededScore(seed: number) {
  return 17 - seed;
}

function hashString(input: string) {
  return input.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export class MockModelAdapter implements ModelAdapter {
  async generateBracket(input: PredictionInput, model: ModelDefinition): Promise<Omit<BracketSubmission, "runId" | "generatedAt">> {
    const teamIndex = indexTeams(input.config);
    const winners = new Map<string, string>();

    const picks = groupGamesByRound(input.config).flatMap(({ round, games }) =>
      games.map((game) => {
        const teamA =
          game.slotA.kind === "team"
            ? teamIndex.get(game.slotA.teamId)
            : teamIndex.get(winners.get(game.slotA.gameId) ?? "");
        const teamB =
          game.slotB.kind === "team"
            ? teamIndex.get(game.slotB.teamId)
            : teamIndex.get(winners.get(game.slotB.gameId) ?? "");

        if (!teamA || !teamB) {
          throw new Error(`Unable to resolve game ${game.id}`);
        }

        const modelBias = hashString(model.id) % 5;
        const scoreA = seededScore(teamA.seed) + (teamA.metrics?.net ?? 0) / 10 + modelBias;
        const scoreB = seededScore(teamB.seed) + (teamB.metrics?.net ?? 0) / 10 + ((modelBias + 2) % 5);
        const winner = scoreA >= scoreB ? teamA : teamB;
        const loser = winner.id === teamA.id ? teamB : teamA;
        const confidence = Math.min(0.95, Math.max(0.51, 0.55 + Math.abs(scoreA - scoreB) / 20));

        winners.set(game.id, winner.id);

        return {
          gameId: game.id,
          winnerId: winner.id,
          confidence,
          rationale: `${winner.name} advances over ${loser.name} because ${model.label} weights seed, NET-like team strength, and path consistency in the ${round}.`
        };
      })
    );

    return {
      configId: input.config.id,
      model,
      picks,
      reasoning: [
        {
          id: "shape-of-bracket",
          title: "Overall bracket construction",
          summary: `${model.label} starts from seed strength, then adjusts for team quality metrics and prefers internally consistent later-round paths.`,
          evidence: [
            "Higher seeds receive a baseline advantage.",
            "Team metrics in the config can override close seed-based games.",
            "Confidence rises when the chosen winner has a clear score gap."
          ]
        },
        {
          id: "source-usage",
          title: "Data sources consulted",
          summary: `${input.sources.length} source snapshots were attached to this run and available to the model agent.`,
          evidence: input.sources.map((source) => `${source.title} (${source.id})`)
        }
      ],
      sources: input.sources
    };
  }
}
