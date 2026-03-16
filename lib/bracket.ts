import { BracketConfig, CompetitorRef, Team, TournamentRound } from "@/lib/types";

export const ROUND_ORDER: TournamentRound[] = [
  "First Four",
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Championship"
];

export function indexTeams(config: BracketConfig): Map<string, Team> {
  return new Map(config.teams.map((team) => [team.id, team]));
}

export function indexGames(config: BracketConfig) {
  return new Map(config.games.map((game) => [game.id, game]));
}

export function resolveCompetitorName(
  config: BracketConfig,
  ref: CompetitorRef,
  pickedWinners: Map<string, string>
): string {
  const teamIndex = indexTeams(config);
  if (ref.kind === "team") {
    return teamIndex.get(ref.teamId)?.name ?? ref.teamId;
  }

  const winnerId = pickedWinners.get(ref.gameId);
  if (!winnerId) {
    return `Winner of ${ref.gameId}`;
  }

  return teamIndex.get(winnerId)?.name ?? winnerId;
}

export function groupGamesByRound(config: BracketConfig) {
  return ROUND_ORDER.map((round) => ({
    round,
    games: config.games.filter((game) => game.round === round)
  })).filter((group) => group.games.length > 0);
}

export function roundPoints(round: TournamentRound): number {
  switch (round) {
    case "First Four":
      return 0;
    case "Round of 64":
      return 1;
    case "Round of 32":
      return 2;
    case "Sweet 16":
      return 4;
    case "Elite 8":
      return 8;
    case "Final Four":
      return 16;
    case "Championship":
      return 32;
  }
}
