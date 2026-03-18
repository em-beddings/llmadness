import { ModelProvider } from "@/lib/types";

export interface ProviderRuntimeConfig {
  provider: Exclude<ModelProvider, "mock">;
  apiKey: string;
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
}

interface ProviderSpec {
  envKey: string;
  baseUrlEnv: string;
  defaultBaseUrl?: string;
  defaultHeaders?: Record<string, string>;
}

export const LIVE_PROVIDERS: Exclude<ModelProvider, "mock">[] = [
  "openai",
  "anthropic",
  "google-gemini",
  "xai",
  "moonshot",
  "qwen",
  "deepseek",
  "mimo",
];

const PROVIDER_SPECS: Record<Exclude<ModelProvider, "mock">, ProviderSpec> = {
  openai: {
    envKey: "OPENAI_API_KEY",
    baseUrlEnv: "OPENAI_BASE_URL",
    defaultBaseUrl: "https://api.openai.com/v1",
  },
  anthropic: {
    envKey: "ANTHROPIC_API_KEY",
    baseUrlEnv: "ANTHROPIC_BASE_URL",
    defaultBaseUrl: "https://api.anthropic.com/v1/",
  },
  "google-gemini": {
    envKey: "GEMINI_API_KEY",
    baseUrlEnv: "GEMINI_BASE_URL",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    defaultHeaders: {
      "x-goog-api-client": "llmadness/0.1",
    },
  },
  xai: {
    envKey: "XAI_API_KEY",
    baseUrlEnv: "XAI_BASE_URL",
    defaultBaseUrl: "https://api.x.ai/v1",
  },
  moonshot: {
    envKey: "KIMI_API_KEY",
    baseUrlEnv: "KIMI_BASE_URL",
    defaultBaseUrl: "https://api.moonshot.ai/v1",
  },
  qwen: {
    envKey: "QWEN_API_KEY",
    baseUrlEnv: "QWEN_BASE_URL",
    defaultBaseUrl: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1",
  },
  deepseek: {
    envKey: "DEEPSEEK_API_KEY",
    baseUrlEnv: "DEEPSEEK_BASE_URL",
    defaultBaseUrl: "https://api.deepseek.com",
  },
  mimo: {
    envKey: "MIMO_API_KEY",
    baseUrlEnv: "MIMO_BASE_URL",
  },
};

export function resolveProviderRuntime(
  provider: ModelProvider,
): ProviderRuntimeConfig {
  if (provider === "mock") {
    throw new Error(
      "Mock provider does not have a live runtime configuration.",
    );
  }

  const spec = PROVIDER_SPECS[provider];
  const apiKey = process.env[spec.envKey];
  if (!apiKey) {
    throw new Error(`${spec.envKey} is required for provider "${provider}".`);
  }

  const baseUrl = process.env[spec.baseUrlEnv] ?? spec.defaultBaseUrl;
  if (!baseUrl) {
    throw new Error(
      `${spec.baseUrlEnv} is required for provider "${provider}".`,
    );
  }

  return {
    provider,
    apiKey,
    baseUrl,
    defaultHeaders: spec.defaultHeaders,
  };
}
