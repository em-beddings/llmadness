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

  return {
    manifest,
    config,
    leaderboard
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
