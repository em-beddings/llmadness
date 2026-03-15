import { ModelDefinition } from "@/lib/types";

const ENV_TOKEN_PATTERN = /^\$\{([A-Z0-9_]+)\}$/;

export function resolveEnvToken(value: string, label: string) {
  const match = value.match(ENV_TOKEN_PATTERN);
  if (!match) {
    return value;
  }

  const envValue = process.env[match[1]];
  if (!envValue) {
    throw new Error(`${label} requires environment variable ${match[1]}.`);
  }

  return envValue;
}

export function resolveModelDefinition(model: ModelDefinition): ModelDefinition {
  return {
    ...model,
    model: resolveEnvToken(model.model, `Model "${model.label}"`)
  };
}
