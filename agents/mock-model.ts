import { indexTeams } from "@/lib/bracket";
import { ModelDefinition } from "@/lib/types";
import { ModelAdapter, PredictionInput } from "@/agents/interfaces";

function seededScore(seed: number) {
  return 17 - seed;
}

function hashString(input: string) {
  return input.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

export class MockModelAdapter implements ModelAdapter {
  async predictGame(
    input: PredictionInput,
    model: ModelDefinition
  ): Promise<{
    pick: {
      gameId: string;
      winnerId: string;
      confidence: number;
      rationale: string;
    };
    reasoningStep: {
      id: string;
      title: string;
      summary: string;
      evidence: string[];
    };
  }> {
    const teamIndex = indexTeams(input.config);
    const currentGame = input.currentGame;

    if (!currentGame) {
      throw new Error("MockModelAdapter requires currentGame.");
    }

    const teamA = teamIndex.get(currentGame.slotATeamId);
    const teamB = teamIndex.get(currentGame.slotBTeamId);

    if (!teamA || !teamB) {
      throw new Error(`Unable to resolve game ${currentGame.game.id}`);
    }

    const modelBias = hashString(model.id) % 5;
    const scoreA = seededScore(teamA.seed) + (teamA.metrics?.net ?? 0) / 10 + modelBias;
    const scoreB = seededScore(teamB.seed) + (teamB.metrics?.net ?? 0) / 10 + ((modelBias + 2) % 5);
    const winner = scoreA >= scoreB ? teamA : teamB;
    const loser = winner.id === teamA.id ? teamB : teamA;
    const confidence = Math.min(0.95, Math.max(0.51, 0.55 + Math.abs(scoreA - scoreB) / 20));

    return {
      pick: {
        gameId: currentGame.game.id,
        winnerId: winner.id,
        confidence,
        rationale: `${winner.name} advances over ${loser.name} because ${model.label} gives the winner a stronger composite profile when seed strength and the built-in team metrics are considered together. This matchup also fits the bracket path the model has already committed to, so the pick balances raw team quality with a coherent tournament progression.`
      },
      reasoningStep: {
        id: `reason-${currentGame.game.id}`,
        title: `${currentGame.game.label}`,
        summary: `${model.label} chose ${winner.name} over ${loser.name}.`,
        evidence: [
          `${winner.name} seed: ${winner.seed}`,
          `${loser.name} seed: ${loser.seed}`,
          `Round: ${currentGame.game.round}`
        ]
      }
    };
  }
}
