import { ModelAdapter } from "@/agents/interfaces";
import { MockModelAdapter } from "@/agents/mock-model";
import { OpenAICompatibleAdapter } from "@/agents/openai-compatible";
import { LIVE_PROVIDERS } from "@/lib/providers";

export function createModelAdapters(): Record<string, ModelAdapter> {
  const liveAdapter = new OpenAICompatibleAdapter();

  return Object.fromEntries([
    ["mock", new MockModelAdapter()],
    ...LIVE_PROVIDERS.map((provider) => [provider, liveAdapter])
  ]);
}
