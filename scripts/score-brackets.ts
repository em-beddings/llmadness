import { normalizeConfidenceValue } from "@/lib/confidence";
import path from "node:path";
import { readJsonFile, writeJsonFile } from "@/lib/fs";
import { loadRunManifest } from "@/lib/repository";
import { actualResultsSchema, bracketConfigSchema, bracketSubmissionSchema } from "@/lib/schema";
import { scoreSubmissions } from "@/lib/scoring";
import { ActualResults, BracketConfig, BracketSubmission } from "@/lib/types";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function normalizeSubmission(submission: BracketSubmission): BracketSubmission {
  return {
    ...submission,
    totalCostUsd:
      submission.totalCostUsd == null
        ? null
        : typeof submission.totalCostUsd === "string"
          ? Number(submission.totalCostUsd)
          : submission.totalCostUsd,
    picks: submission.picks.map((pick) => ({
      ...pick,
      confidence: normalizeConfidenceValue(pick.confidence) as number
    })),
    reasoning: submission.reasoning.map((step) => ({
      ...step,
      id: String(step.id),
      evidence: Array.isArray(step.evidence)
        ? step.evidence
        : typeof step.evidence === "string"
          ? [step.evidence]
          : []
    })),
    gameRuns: (submission.gameRuns ?? []).map((gameRun) => ({
      ...gameRun,
      pick: {
        ...gameRun.pick,
        confidence: normalizeConfidenceValue(gameRun.pick.confidence) as number
      },
      reasoningStep: gameRun.reasoningStep
        ? {
            ...gameRun.reasoningStep,
            id: String(gameRun.reasoningStep.id),
            evidence: Array.isArray(gameRun.reasoningStep.evidence)
              ? gameRun.reasoningStep.evidence
              : typeof gameRun.reasoningStep.evidence === "string"
                ? [gameRun.reasoningStep.evidence]
                : []
          }
        : gameRun.reasoningStep
    }))
  };
}

async function main() {
  const runId = readArg("--run-id");
  const actualResultsPath = readArg("--results");

  if (!runId || !actualResultsPath) {
    throw new Error("Usage: npm run score:brackets -- --run-id <id> --results <file>");
  }

  const manifest = await loadRunManifest(runId);
  const config = bracketConfigSchema.parse(
    await readJsonFile<BracketConfig>(path.join(process.cwd(), manifest.configPath))
  );
  const actualResults = actualResultsSchema.parse(
    await readJsonFile<ActualResults>(path.join(process.cwd(), actualResultsPath))
  );

  const submissions: BracketSubmission[] = await Promise.all(
    manifest.submissions.map(async (submission) => {
      const filePath = path.join(process.cwd(), submission.file);
      const normalized = normalizeSubmission(await readJsonFile<BracketSubmission>(filePath));
      const parsed = bracketSubmissionSchema.parse(normalized) as BracketSubmission;
      await writeJsonFile(filePath, parsed);
      return parsed;
    })
  );

  const leaderboard = scoreSubmissions(runId, config, submissions, actualResults);

  await writeJsonFile(path.join(process.cwd(), "data", "runs", runId, "leaderboard.json"), leaderboard);
  await writeJsonFile(path.join(process.cwd(), "data", "runs", runId, "actual-results.json"), actualResults);
  await writeJsonFile(path.join(process.cwd(), "data", "runs", runId, "manifest.json"), {
    ...manifest,
    leaderboardPath: path.join("data", "runs", runId, "leaderboard.json"),
    actualResultsPath: path.join("data", "runs", runId, "actual-results.json")
  });
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
