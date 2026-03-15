import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { readJsonFile } from "@/lib/fs";
import { resolveModelDefinition } from "@/lib/model-runtime";
import { resolveProviderRuntime } from "@/lib/providers";
import { modelDefinitionSchema } from "@/lib/schema";
import { ModelDefinition } from "@/lib/types";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

async function main() {
  loadEnvConfig(process.cwd());

  const modelsPath = readArg("--models") ?? "data/models/live-models.json";
  const models = modelDefinitionSchema.array().parse(
    await readJsonFile<ModelDefinition[]>(path.join(process.cwd(), modelsPath))
  );

  const issues: string[] = [];

  for (const model of models) {
    try {
      const resolved = resolveModelDefinition(model);
      if (resolved.provider !== "mock") {
        resolveProviderRuntime(resolved.provider);
      }
    } catch (error) {
      issues.push(`${model.label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (issues.length > 0) {
    throw new Error(`Live model setup is incomplete:\n- ${issues.join("\n- ")}`);
  }

  console.log(`Validated ${models.length} model definitions from ${modelsPath}.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
