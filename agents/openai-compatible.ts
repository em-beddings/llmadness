import { BracketSubmission, ModelDefinition } from "@/lib/types";
import { ModelAdapter, PredictionInput } from "@/agents/interfaces";

function buildPrompt(input: PredictionInput) {
  return [
    "You are filling out a complete March Madness bracket.",
    "Return strict JSON with keys: configId, model, picks, reasoning, sources.",
    "Each pick must include gameId, winnerId, confidence (0-1), and rationale.",
    "Each reasoning step must include id, title, summary, and evidence array.",
    "Use only team IDs that appear in the bracket.",
    "",
    `Bracket config: ${JSON.stringify(input.config)}`,
    `Source snapshots: ${JSON.stringify(input.sources)}`
  ].join("\n");
}

export class OpenAICompatibleAdapter implements ModelAdapter {
  async generateBracket(input: PredictionInput, model: ModelDefinition): Promise<Omit<BracketSubmission, "runId" | "generatedAt">> {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for openai-compatible models.");
    }

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: model.model,
        temperature: Number(model.settings?.temperature ?? 0.2),
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You are a college basketball bracket analyst. You must return valid JSON."
          },
          {
            role: "user",
            content: buildPrompt(input)
          }
        ]
      })
    });

    if (!response.ok) {
      throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
    }

    const payload = (await response.json()) as {
      choices?: Array<{
        message?: {
          content?: string;
        };
      }>;
    };

    const content = payload.choices?.[0]?.message?.content;
    if (!content) {
      throw new Error("Model returned no content.");
    }

    return JSON.parse(content) as Omit<BracketSubmission, "runId" | "generatedAt">;
  }
}
