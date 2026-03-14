import { indexGames, roundPoints } from "@/lib/bracket";
import { ActualResults, BracketConfig, BracketSubmission, Leaderboard, LeaderboardEntry } from "@/lib/types";

export function scoreSubmissions(
  runId: string,
  config: BracketConfig,
  submissions: BracketSubmission[],
  actualResults: ActualResults
): Leaderboard {
  const resultMap = new Map(actualResults.results.map((result) => [result.gameId, result.winnerId]));
  const gameIndex = indexGames(config);

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
    const maxPoints = config.games.reduce((sum, game) => sum + roundPoints(game.round), 0);
    const correctCount = gameScores.filter((game) => game.correct).length;

    return {
      modelId: submission.model.id,
      modelLabel: submission.model.label,
      totalPoints,
      maxPoints,
      accuracy: submission.picks.length === 0 ? 0 : correctCount / submission.picks.length,
      gameScores
    };
  });

  return {
    runId,
    scoredAt: new Date().toISOString(),
    entries: entries.sort((left, right) => right.totalPoints - left.totalPoints)
  };
}
