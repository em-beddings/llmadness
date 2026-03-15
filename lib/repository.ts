import path from "node:path";
import { cache } from "react";
import { groupGamesByRound, indexTeams, resolveCompetitorName } from "@/lib/bracket";
import { readJsonFile } from "@/lib/fs";
import {
  ActualResults,
  BracketConfig,
  BracketSubmission,
  Leaderboard,
  TournamentRound
} from "@/lib/types";

const ROOT = process.cwd();
const DATA_DIR = path.join(ROOT, "data");
const CONFIG_DIR = path.join(DATA_DIR, "configs");
const RUNS_DIR = path.join(DATA_DIR, "runs");

export interface RunManifest {
  id: string;
  title: string;
  createdAt: string;
  configPath: string;
  submissions: Array<{
    modelId: string;
    file: string;
  }>;
  leaderboardPath?: string;
  actualResultsPath?: string;
}

export interface RenderedGame {
  id: string;
  label: string;
  round: TournamentRound;
  region?: string;
  slotA: string;
  slotB: string;
  winner: string | null;
  confidence: number | null;
  rationale: string | null;
}

export interface SubmissionView {
  submission: BracketSubmission;
  gamesByRound: Array<{
    round: TournamentRound;
    games: RenderedGame[];
  }>;
}

export interface SubmissionSummary {
  modelId: string;
  modelLabel: string;
  description?: string;
  championshipPick: string | null;
  finalFourPicks: string[];
}

export const loadRunManifest = cache(async (runId: string) => {
  return readJsonFile<RunManifest>(path.join(RUNS_DIR, runId, "manifest.json"));
});

export const loadBracketConfig = cache(async (configPath: string) => {
  return readJsonFile<BracketConfig>(path.join(ROOT, configPath));
});

export const loadLeaderboard = cache(async (runId: string) => {
  const manifest = await loadRunManifest(runId);
  if (!manifest.leaderboardPath) {
    return null;
  }

  return readJsonFile<Leaderboard>(path.join(ROOT, manifest.leaderboardPath));
});

export const loadActualResults = cache(async (runId: string) => {
  const manifest = await loadRunManifest(runId);
  if (!manifest.actualResultsPath) {
    return null;
  }

  return readJsonFile<ActualResults>(path.join(ROOT, manifest.actualResultsPath));
});

export const loadSubmission = cache(async (runId: string, modelId: string) => {
  const manifest = await loadRunManifest(runId);
  const submissionRef = manifest.submissions.find((entry) => entry.modelId === modelId);
  if (!submissionRef) {
    return null;
  }

  return readJsonFile<BracketSubmission>(path.join(ROOT, submissionRef.file));
});

export async function loadSubmissionView(runId: string, modelId: string): Promise<SubmissionView | null> {
  const [manifest, submission] = await Promise.all([loadRunManifest(runId), loadSubmission(runId, modelId)]);
  if (!submission) {
    return null;
  }

  const config = await loadBracketConfig(manifest.configPath);
  const teamIndex = indexTeams(config);
  const picks = new Map(submission.picks.map((pick) => [pick.gameId, pick]));
  const winners = new Map(submission.picks.map((pick) => [pick.gameId, pick.winnerId]));

  return {
    submission,
    gamesByRound: groupGamesByRound(config).map(({ round, games }) => ({
      round,
      games: games.map((game) => {
        const pick = picks.get(game.id);
        return {
          id: game.id,
          label: game.label,
          round: game.round,
          region: game.region,
          slotA: resolveCompetitorName(config, game.slotA, winners),
          slotB: resolveCompetitorName(config, game.slotB, winners),
          winner: pick ? teamIndex.get(pick.winnerId)?.name ?? pick.winnerId : null,
          confidence: pick?.confidence ?? null,
          rationale: pick?.rationale ?? null
        };
      })
    }))
  };
}

export async function loadDashboard(runId: string) {
  const manifest = await loadRunManifest(runId);
  const [config, leaderboard] = await Promise.all([
    loadBracketConfig(manifest.configPath),
    loadLeaderboard(runId)
  ]);
  const teamIndex = indexTeams(config);
  const submissions = await Promise.all(
    manifest.submissions.map(async (entry) => {
      const submission = await readJsonFile<BracketSubmission>(path.join(ROOT, entry.file));
      const championshipGame = config.games.find((game) => game.round === "Championship");
      const finalFourGames = config.games.filter((game) => game.round === "Final Four");
      const championshipPick = championshipGame
        ? submission.picks.find((pick) => pick.gameId === championshipGame.id)
        : undefined;

      return {
        modelId: submission.model.id,
        modelLabel: submission.model.label,
        description: submission.model.description,
        championshipPick: championshipPick ? teamIndex.get(championshipPick.winnerId)?.name ?? championshipPick.winnerId : null,
        finalFourPicks: finalFourGames
          .map((game) => submission.picks.find((pick) => pick.gameId === game.id))
          .filter((pick): pick is NonNullable<typeof pick> => Boolean(pick))
          .map((pick) => teamIndex.get(pick.winnerId)?.name ?? pick.winnerId)
      } satisfies SubmissionSummary;
    })
  );

  return {
    manifest,
    config,
    leaderboard,
    submissions
  };
}

export function getDataPaths() {
  return {
    ROOT,
    DATA_DIR,
    CONFIG_DIR,
    RUNS_DIR
  };
}
