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
    manifest.submissions.map(async (submission) =>
      bracketSubmissionSchema.parse(
        await readJsonFile<BracketSubmission>(path.join(process.cwd(), submission.file))
      ) as BracketSubmission
    )
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
