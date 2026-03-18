import path from "node:path";
import { mkdir, readdir } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { CentralBracketAgent } from "@/agents/central-agent";
import { MockModelAdapter } from "@/agents/mock-model";
import { OpenAICompatibleAdapter } from "@/agents/openai-compatible";
import { readJsonFile, writeJsonFile } from "@/lib/fs";
import { resolveModelDefinition } from "@/lib/model-runtime";
import { LIVE_PROVIDERS } from "@/lib/providers";
import { RunManifest } from "@/lib/repository";
import { bracketConfigSchema, modelDefinitionSchema } from "@/lib/schema";
import { BracketConfig, ModelDefinition } from "@/lib/types";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function loadExistingManifest(outDir: string) {
  try {
    return await readJsonFile<RunManifest>(path.join(outDir, "manifest.json"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function discoverSubmissionRefs(outDir: string) {
  const entries = await readdir(outDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => entry.name)
    .filter((name) => !["manifest.json", "leaderboard.json", "actual-results.json"].includes(name))
    .map((name) => ({
      modelId: name.replace(/\.json$/, ""),
      file: path.join("data", "runs", path.basename(outDir), name)
    }))
    .sort((left, right) => left.modelId.localeCompare(right.modelId));
}

async function main() {
  loadEnvConfig(process.cwd());

  const configPath = readArg("--config");
  const modelsPath = readArg("--models");
  const runId = readArg("--run-id") ?? `run-${new Date().toISOString().slice(0, 10)}`;

  if (!configPath || !modelsPath) {
    throw new Error("Usage: npm run generate:brackets -- --config <file> --models <file> [--run-id <id>]");
  }

  const config = bracketConfigSchema.parse(await readJsonFile<BracketConfig>(path.join(process.cwd(), configPath)));
  const models = modelDefinitionSchema.array().parse(
    await readJsonFile<ModelDefinition[]>(path.join(process.cwd(), modelsPath))
  ).map(resolveModelDefinition);

  const outDir = path.join(process.cwd(), "data", "runs", runId);
  await mkdir(outDir, { recursive: true });
  const existingManifest = await loadExistingManifest(outDir);
  const discoveredSubmissions = await discoverSubmissionRefs(outDir);

  if (existingManifest && existingManifest.configPath !== configPath) {
    throw new Error(
      `Run "${runId}" already exists with config "${existingManifest.configPath}". ` +
        `Use the same config path or choose a different run id.`
    );
  }

  const liveAdapter = new OpenAICompatibleAdapter();
  const agent = new CentralBracketAgent(
    Object.fromEntries([
      ["mock", new MockModelAdapter()],
      ...LIVE_PROVIDERS.map((provider) => [provider, liveAdapter])
    ])
  );

  const manifest: RunManifest = existingManifest
    ? {
        ...existingManifest,
        submissions: [...existingManifest.submissions]
      }
    : {
    id: runId,
    title: `${config.title} bracket run`,
    createdAt: new Date().toISOString(),
    configPath,
    submissions: []
  };

  manifest.title = `${config.title} bracket run`;
  manifest.configPath = configPath;

  for (const discovered of discoveredSubmissions) {
    const existingIndex = manifest.submissions.findIndex((entry) => entry.modelId === discovered.modelId);
    if (existingIndex >= 0) {
      manifest.submissions[existingIndex] = discovered;
    } else {
      manifest.submissions.push(discovered);
    }
  }

  for (const model of models) {
    const submission = await agent.run(runId, config, model);
    const file = path.join("data", "runs", runId, `${model.id}.json`);
    await writeJsonFile(path.join(process.cwd(), file), submission);
    const existingIndex = manifest.submissions.findIndex((entry) => entry.modelId === model.id);
    if (existingIndex >= 0) {
      manifest.submissions[existingIndex] = { modelId: model.id, file };
    } else {
      manifest.submissions.push({ modelId: model.id, file });
    }
  }

  manifest.submissions.sort((left, right) => left.modelId.localeCompare(right.modelId));

  await writeJsonFile(path.join(outDir, "manifest.json"), manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
