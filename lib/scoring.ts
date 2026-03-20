import { indexGames, roundPoints } from "@/lib/bracket";
import {
  ActualResults,
  BracketConfig,
  BracketSubmission,
  CompetitorRef,
  Leaderboard,
  LeaderboardEntry
} from "@/lib/types";

function canRefStillProduceTeam(
  config: BracketConfig,
  resultMap: Map<string, string | undefined>,
  ref: CompetitorRef,
  teamId: string
): boolean {
  if (ref.kind === "team") {
    return ref.teamId === teamId;
  }

  const knownWinner = resultMap.get(ref.gameId);
  if (knownWinner) {
    return knownWinner === teamId;
  }

  const sourceGame = config.games.find((game) => game.id === ref.gameId);
  if (!sourceGame) {
    return false;
  }

  return (
    canRefStillProduceTeam(config, resultMap, sourceGame.slotA, teamId) ||
    canRefStillProduceTeam(config, resultMap, sourceGame.slotB, teamId)
  );
}

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
    const pointsRemaining = submission.picks.reduce((sum, pick) => {
      const game = gameIndex.get(pick.gameId);
      if (!game) {
        return sum;
      }

      const resultWinner = resultMap.get(pick.gameId);
      if (resultWinner) {
        return sum;
      }

      const stillAlive =
        canRefStillProduceTeam(config, resultMap, game.slotA, pick.winnerId) ||
        canRefStillProduceTeam(config, resultMap, game.slotB, pick.winnerId);

      return stillAlive ? sum + roundPoints(game.round) : sum;
    }, 0);
    const maxPoints = totalPoints + pointsRemaining;
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
