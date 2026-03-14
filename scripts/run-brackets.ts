import path from "node:path";
import { mkdir } from "node:fs/promises";
import { CentralBracketAgent } from "@/agents/central-agent";
import { DerivedTeamSnapshotDataSource, StaticFileDataSource } from "@/agents/data-sources";
import { MockModelAdapter } from "@/agents/mock-model";
import { OpenAICompatibleAdapter } from "@/agents/openai-compatible";
import { readJsonFile, writeJsonFile } from "@/lib/fs";
import { bracketConfigSchema, modelDefinitionSchema } from "@/lib/schema";
import { BracketConfig, ModelDefinition } from "@/lib/types";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  const configPath = readArg("--config");
  const modelsPath = readArg("--models");
  const runId = readArg("--run-id") ?? `run-${new Date().toISOString().slice(0, 10)}`;

  if (!configPath || !modelsPath) {
    throw new Error("Usage: npm run generate:brackets -- --config <file> --models <file> [--run-id <id>]");
  }

  const config = bracketConfigSchema.parse(await readJsonFile<BracketConfig>(path.join(process.cwd(), configPath)));
  const models = modelDefinitionSchema.array().parse(
    await readJsonFile<ModelDefinition[]>(path.join(process.cwd(), modelsPath))
  );

  const outDir = path.join(process.cwd(), "data", "runs", runId);
  await mkdir(outDir, { recursive: true });

  const agent = new CentralBracketAgent(
    [
      new DerivedTeamSnapshotDataSource(),
      new StaticFileDataSource("news-digest", "News digest", "data/sources/demo-news.json"),
      new StaticFileDataSource("injury-report", "Injury report", "data/sources/demo-injuries.json")
    ],
    {
      mock: new MockModelAdapter(),
      "openai-compatible": new OpenAICompatibleAdapter()
    }
  );

  const manifest = {
    id: runId,
    title: `${config.title} bracket run`,
    createdAt: new Date().toISOString(),
    configPath,
    submissions: [] as Array<{ modelId: string; file: string }>
  };

  for (const model of models) {
    const submission = await agent.run(runId, config, model);
    const file = path.join("data", "runs", runId, `${model.id}.json`);
    await writeJsonFile(path.join(process.cwd(), file), submission);
    manifest.submissions.push({ modelId: model.id, file });
  }

  await writeJsonFile(path.join(outDir, "manifest.json"), manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
