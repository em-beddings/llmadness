import { indexGames, roundPoints } from "@/lib/bracket";
import {
  ActualResults,
  BracketConfig,
  BracketSubmission,
  Leaderboard,
  LeaderboardEntry
} from "@/lib/types";

export function scoreSubmissions(
  runId: string,
  config: BracketConfig,
  submissions: BracketSubmission[],
  actualResults: ActualResults
): Leaderboard {
  const resultMap = new Map(actualResults.results.map((result) => [result.gameId, result.winnerId]));
  const resolvedResultsCount = actualResults.results.filter((result) => Boolean(result.winnerId)).length;
  const gameIndex = indexGames(config);
  const totalAvailablePoints = config.games.reduce((sum, game) => sum + roundPoints(game.round), 0);

  const entries: LeaderboardEntry[] = submissions.map((submission) => {
    const submissionPickMap = new Map(submission.picks.map((pick) => [pick.gameId, pick]));
    const gameScores = submission.picks.map((pick) => {
      const resultWinner = resultMap.get(pick.gameId);
      const round = gameIndex.get(pick.gameId)?.round ?? "Round of 64";
      const correct = resultWinner === pick.winnerId;
      const pointsAwarded = correct ? roundPoints(round) : 0;

      return {
        gameId: pick.gameId,
        round,
        correct,
        pointsAwarded
      };
    });

    const totalPoints = gameScores.reduce((sum, game) => sum + game.pointsAwarded, 0);
    const lostResolvedPoints = actualResults.results.reduce((sum, result) => {
      if (!result.winnerId) {
        return sum;
      }

      const game = gameIndex.get(result.gameId);
      if (!game) {
        return sum;
      }

      const pick = submissionPickMap.get(result.gameId);
      if (pick?.winnerId === result.winnerId) {
        return sum;
      }

      return sum + roundPoints(game.round);
    }, 0);
    const maxPoints = totalAvailablePoints - lostResolvedPoints;
    const pointsRemaining = Math.max(0, maxPoints - totalPoints);
    const correctCount = gameScores.filter((game) => game.correct).length;

    return {
      modelId: submission.model.id,
      modelLabel: submission.model.label,
      totalPoints,
      totalAvailablePoints,
      maxPoints,
      pointsRemaining,
      totalCostUsd: submission.totalCostUsd ?? null,
      accuracy: resolvedResultsCount === 0 ? 0 : correctCount / resolvedResultsCount,
      gameScores
    };
  });

  return {
    runId,
    scoredAt: new Date().toISOString(),
    entries: entries.sort((left, right) => {
      if (right.totalPoints !== left.totalPoints) {
        return right.totalPoints - left.totalPoints;
      }

      const leftCost = left.totalCostUsd;
      const rightCost = right.totalCostUsd;

      if (leftCost == null && rightCost == null) {
        return 0;
      }

      if (leftCost == null) {
        return 1;
      }

      if (rightCost == null) {
        return -1;
      }

      return leftCost - rightCost;
    })
  };
}
