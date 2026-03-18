import { loadEnvConfig } from "@next/env";
import { resolveModelDefinition } from "@/lib/model-runtime";
import { resolveProviderRuntime } from "@/lib/providers";
import { readJsonFile } from "@/lib/fs";
import { modelDefinitionSchema } from "@/lib/schema";
import { ModelDefinition } from "@/lib/types";

function readArg(flag: string) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] : null;
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

function resolveTemperature(model: ModelDefinition) {
  if (model.provider === "moonshot") {
    return 1;
  }

  return 0;
}

async function main() {
  loadEnvConfig(process.cwd());

  const modelsPath = readArg("--models");
  if (!modelsPath) {
    throw new Error("Usage: npm run test:provider -- --models <file>");
  }

  const models = modelDefinitionSchema.array().parse(
    await readJsonFile<ModelDefinition[]>(modelsPath)
  ).map(resolveModelDefinition);

  if (models.length !== 1) {
    throw new Error("Provider smoke test expects exactly one model definition.");
  }

  const model = models[0];
  if (model.provider === "mock") {
    throw new Error("Provider smoke test does not apply to mock models.");
  }

  const runtime = resolveProviderRuntime(model.provider);
  const response = await fetch(joinUrl(runtime.baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${runtime.apiKey}`,
      ...runtime.defaultHeaders
    },
    body: JSON.stringify({
      model: model.model,
      messages: [{ role: "user", content: "Reply with the single word OK." }],
      temperature: resolveTemperature(model)
    })
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`Smoke test failed for ${model.label}: ${response.status} ${text}`);
  }

  console.log(`Smoke test passed for ${model.label}.`);
  console.log(text);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
