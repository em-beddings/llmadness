import { ModelDefinition, ModelProvider } from "@/lib/types";

export type ProviderBrand =
  | "openai"
  | "anthropic"
  | "google-gemini"
  | "xai"
  | "moonshot"
  | "qwen"
  | "minimax"
  | "deepseek"
  | "mimo"
  | "unknown";

const PROVIDER_LABELS: Record<ProviderBrand, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  "google-gemini": "Google Gemini",
  xai: "xAI",
  moonshot: "Moonshot",
  qwen: "Qwen",
  minimax: "MiniMax",
  deepseek: "DeepSeek",
  mimo: "MiMo",
  unknown: "Unknown"
};

function inferFromText(value: string): ProviderBrand {
  const normalized = value.toLowerCase();

  if (normalized.includes("gpt")) return "openai";
  if (normalized.includes("claude")) return "anthropic";
  if (normalized.includes("gemini")) return "google-gemini";
  if (normalized.includes("grok")) return "xai";
  if (normalized.includes("kimi")) return "moonshot";
  if (normalized.includes("qwen")) return "qwen";
  if (normalized.includes("minimax")) return "minimax";
  if (normalized.includes("deepseek")) return "deepseek";
  if (normalized.includes("mimo")) return "mimo";

  return "unknown";
}

export function resolveProviderBrand(model: Pick<ModelDefinition, "provider" | "id" | "label">): ProviderBrand {
  if (model.provider !== "mock") {
    return model.provider as Exclude<ModelProvider, "mock">;
  }

  return inferFromText(`${model.id} ${model.label}`);
}

export function getProviderLabel(brand: ProviderBrand) {
  return PROVIDER_LABELS[brand];
}
