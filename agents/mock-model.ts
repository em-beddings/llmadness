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
    const scoreA = seededScore(teamA.seed) + modelBias;
    const scoreB = seededScore(teamB.seed) + ((modelBias + 2) % 5);
    const winner = scoreA >= scoreB ? teamA : teamB;
    const loser = winner.id === teamA.id ? teamB : teamA;
    const confidence = Math.min(0.95, Math.max(0.51, 0.55 + Math.abs(scoreA - scoreB) / 20));

    return {
      pick: {
        gameId: currentGame.game.id,
        winnerId: winner.id,
        confidence,
        rationale: `${winner.name} advances over ${loser.name} because ${model.label} rates the matchup more favorably once seed position and its internal decision bias are applied together. This mock pick is mainly meant to exercise the bracket flow and keep the tournament path coherent from one game to the next, rather than to reflect any live statistical edge.`
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
