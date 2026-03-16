import { ModelDefinition } from "@/lib/types";
import { ModelAdapter, PredictionInput } from "@/agents/interfaces";
import { resolveProviderRuntime } from "@/lib/providers";

type ChatMessage =
  | { role: "system" | "user" | "assistant"; content: string | null; tool_calls?: ToolCall[] }
  | { role: "tool"; content: string; tool_call_id: string };

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

function compactValue(value: unknown, depth = 0): unknown {
  if (typeof value === "string") {
    return value.length > 1200 ? `${value.slice(0, 1200)}... [truncated ${value.length - 1200} chars]` : value;
  }

  if (value == null || typeof value !== "object") {
    return value;
  }

  if (depth >= 3) {
    if (Array.isArray(value)) {
      return `[array(${value.length})]`;
    }

    return "[object]";
  }

  if (Array.isArray(value)) {
    const limit = depth === 0 ? 4 : 3;
    return value.slice(0, limit).map((item) => compactValue(item, depth + 1));
  }

  const entries = Object.entries(value);
  const limit = depth === 0 ? 12 : 8;
  return Object.fromEntries(entries.slice(0, limit).map(([key, entryValue]) => [key, compactValue(entryValue, depth + 1)]));
}

function serializeToolResultForModel(toolName: string, result: unknown) {
  return JSON.stringify(
    {
      toolName,
      result: compactValue(result)
    },
    null,
    2
  );
}

function buildSystemPrompt(input: PredictionInput, maxToolRounds: number) {
  const currentGame = input.currentGame;
  if (!currentGame) {
    throw new Error("OpenAICompatibleAdapter requires currentGame.");
  }

  return [
    "You are an analyst predicting a single March Madness game inside a bracket run.",
    "You have live tools. Use them before making a pick when they can reduce uncertainty.",
    "You are not filling the whole bracket in one response. Predict only the current game.",
    "Use prior picks as already committed bracket state.",
    `You may use at most ${maxToolRounds} tool rounds before you must finalize your answer.`,
    "Before making a pick, investigate relevant context such as injuries or availability concerns, recent team news, prior head-to-head results when useful, and multiple raw statistics from the available ratings and matchup data.",
    "Take a holistic approach. Balance team quality, matchup specifics, health, form, schedule context, and upset risk instead of relying on one metric.",
    "Do not force an upset, but explicitly consider whether the underdog has a credible path to win and let that affect confidence and rationale.",
    "Return strict JSON only.",
    "Final JSON keys: pick, reasoningStep.",
    "pick must contain gameId, winnerId, confidence, rationale.",
    "The rationale must be a short paragraph of 2 to 4 sentences explaining why the winner was chosen.",
    "reasoningStep must contain id, title, summary, evidence.",
    `Bracket config id: ${input.config.id}`,
    `Tournament year: ${input.config.year}`,
    `Current game id: ${currentGame.game.id}`,
    `Current game label: ${currentGame.game.label}`,
    `Round: ${currentGame.game.round}`,
    `Resolved teams: ${currentGame.slotAName} (${currentGame.slotATeamId}) vs ${currentGame.slotBName} (${currentGame.slotBTeamId})`,
    `Prior committed picks: ${input.priorPicks.length}`
  ].join("\n");
}

function buildUserPrompt(input: PredictionInput) {
  const currentGame = input.currentGame;
  if (!currentGame) {
    throw new Error("OpenAICompatibleAdapter requires currentGame.");
  }

  return [
    "Predict the winner of the current game only.",
    "Use only one of the two resolved team IDs as winnerId.",
    "The prior picks are the committed winners of earlier rounds and define the matchup path.",
    "Write the pick rationale as a short paragraph, not bullets or fragments.",
    "",
    JSON.stringify(
      {
        currentGame,
        priorPicks: input.priorPicks.slice(-12),
        configId: input.config.id
      },
      null,
      2
    )
  ].join("\n");
}

function buildFinalJsonInstruction() {
  return "Return the final answer now as strict JSON only with keys pick and reasoningStep. The pick.rationale must be a short paragraph.";
}

function buildResponseFormat() {
  return {
    type: "json_schema" as const,
    json_schema: {
      name: "llmadness_game_prediction",
      strict: true,
      schema: {
        type: "object",
        additionalProperties: false,
        properties: {
          pick: {
            type: "object",
            additionalProperties: false,
            properties: {
              gameId: { type: "string" },
              winnerId: { type: "string" },
              confidence: { type: "number" },
              rationale: { type: "string" }
            },
            required: ["gameId", "winnerId", "confidence", "rationale"]
          },
          reasoningStep: {
            type: "object",
            additionalProperties: false,
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              summary: { type: "string" },
              evidence: {
                type: "array",
                items: { type: "string" }
              }
            },
            required: ["id", "title", "summary", "evidence"]
          }
        },
        required: ["pick", "reasoningStep"]
      }
    }
  };
}

function extractJsonObject(content: string) {
  const trimmed = content.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const fencedMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return trimmed.slice(firstBrace, lastBrace + 1);
  }

  return trimmed;
}

function mapTools(input: PredictionInput) {
  return input.tools.list().map((tool) => ({
    type: "function" as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema
    }
  }));
}

function joinUrl(baseUrl: string, path: string) {
  return `${baseUrl.replace(/\/+$/, "")}/${path.replace(/^\/+/, "")}`;
}

async function createChatCompletion(
  body: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
  defaultHeaders?: Record<string, string>
) {
  const response = await fetch(joinUrl(baseUrl, "/chat/completions"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...defaultHeaders
    },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(`Model request failed: ${response.status} ${await response.text()}`);
  }

  return (await response.json()) as {
    choices?: Array<{
      message?: {
        role?: "assistant";
        content?: string | null;
        tool_calls?: ToolCall[];
      };
    }>;
  };
}

async function requestFinalJson(
  params: {
    model: string;
    temperature: number;
    messages: ChatMessage[];
  },
  runtime: ReturnType<typeof resolveProviderRuntime>
) {
  const finalMessages = [
    ...params.messages,
    {
      role: "user" as const,
      content: buildFinalJsonInstruction()
    }
  ];

  try {
    return await createChatCompletion(
      {
        model: params.model,
        temperature: params.temperature,
        messages: finalMessages,
        response_format: buildResponseFormat()
      },
      runtime.apiKey,
      runtime.baseUrl,
      runtime.defaultHeaders
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!/response_format|json_schema|json_object/i.test(message)) {
      throw error;
    }

    return createChatCompletion(
      {
        model: params.model,
        temperature: params.temperature,
        messages: finalMessages
      },
      runtime.apiKey,
      runtime.baseUrl,
      runtime.defaultHeaders
    );
  }
}

export class OpenAICompatibleAdapter implements ModelAdapter {
  async predictGame(input: PredictionInput, model: ModelDefinition) {
    const runtime = resolveProviderRuntime(model.provider);
    const maxToolRounds = Number(model.settings?.maxToolRounds ?? 10);

    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(input, maxToolRounds) },
      { role: "user", content: buildUserPrompt(input) }
    ];

    const tools = mapTools(input);

    for (let step = 0; step < maxToolRounds; step += 1) {
      const payload = await createChatCompletion(
        {
          model: model.model,
          temperature: Number(model.settings?.temperature ?? 0.2),
          messages,
          tools,
          tool_choice: "auto"
        },
        runtime.apiKey,
        runtime.baseUrl,
        runtime.defaultHeaders
      );

      const message = payload.choices?.[0]?.message;
      if (!message) {
        throw new Error("Model returned no message.");
      }

      if (message.tool_calls && message.tool_calls.length > 0) {
        messages.push({
          role: "assistant",
          content: message.content ?? null,
          tool_calls: message.tool_calls
        });

        for (const toolCall of message.tool_calls) {
          const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          const result = await input.tools.invoke(toolCall.function.name, args);
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: serializeToolResultForModel(toolCall.function.name, result)
          });
        }

        continue;
      }

      const finalPayload = await requestFinalJson(
        {
          model: model.model,
          temperature: Number(model.settings?.temperature ?? 0.2),
          messages: [
            ...messages,
            {
              role: "assistant",
              content: message.content ?? ""
            }
          ]
        },
        runtime
      );

      const content = finalPayload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Model returned no final JSON content.");
      }

      return JSON.parse(extractJsonObject(content)) as {
        pick: {
          gameId: string;
          winnerId: string;
          confidence: number;
          rationale: string;
        };
        reasoningStep?: {
          id: string;
          title: string;
          summary: string;
          evidence: string[];
        };
      };
    }

    throw new Error(`Model exceeded max tool rounds (${maxToolRounds}) without producing a final answer.`);
  }
}
