import { ModelDefinition, ModelTraceEvent } from "@/lib/types";
import { ModelAdapter, PredictionInput } from "@/agents/interfaces";
import { resolveProviderRuntime } from "@/lib/providers";

interface RateLimitBudget {
  requestsPerMinute?: number;
  inputTokensPerMinute?: number;
  minDelayMs?: number;
}

interface RateLimitState {
  requestTimestamps: number[];
  tokenReservations: Array<{ timestamp: number; tokens: number }>;
  nextAvailableAt: number;
}

type ChatMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
      reasoning_content?: string | null;
    }
  | { role: "tool"; content: string; tool_call_id: string };

interface ToolCall {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
}

const ONE_MINUTE_MS = 60_000;
const TOKEN_ESTIMATE_DIVISOR = 4;

const DEFAULT_RATE_LIMITS: Record<string, RateLimitBudget> = {
  openai: {
    requestsPerMinute: 60,
    inputTokensPerMinute: 180_000,
    minDelayMs: 250
  },
  anthropic: {
    requestsPerMinute: 30,
    inputTokensPerMinute: 24_000,
    minDelayMs: 700
  },
  "google-gemini": {
    requestsPerMinute: 30,
    inputTokensPerMinute: 120_000,
    minDelayMs: 350
  },
  xai: {
    requestsPerMinute: 30,
    inputTokensPerMinute: 120_000,
    minDelayMs: 350
  },
  moonshot: {
    requestsPerMinute: 30,
    inputTokensPerMinute: 120_000,
    minDelayMs: 350
  },
  qwen: {
    requestsPerMinute: 30,
    inputTokensPerMinute: 120_000,
    minDelayMs: 350
  },
  deepseek: {
    requestsPerMinute: 30,
    inputTokensPerMinute: 120_000,
    minDelayMs: 350
  },
  mimo: {
    requestsPerMinute: 30,
    inputTokensPerMinute: 120_000,
    minDelayMs: 350
  }
};

const rateLimitStates = new Map<string, RateLimitState>();

function traceEvent(
  id: string,
  type: ModelTraceEvent["type"],
  payload: Pick<ModelTraceEvent, "content" | "toolName" | "arguments" | "result"> = {}
): ModelTraceEvent {
  return {
    id,
    type,
    createdAt: new Date().toISOString(),
    ...payload
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

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getNumericSetting(model: ModelDefinition, key: string) {
  const value = model.settings?.[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function estimateInputTokens(body: Record<string, unknown>) {
  return Math.max(1, Math.ceil(JSON.stringify(body).length / TOKEN_ESTIMATE_DIVISOR));
}

function getRateLimitBudget(model: ModelDefinition) {
  const defaults = DEFAULT_RATE_LIMITS[model.provider] ?? {};

  return {
    requestsPerMinute: getNumericSetting(model, "requestsPerMinute") ?? defaults.requestsPerMinute,
    inputTokensPerMinute: getNumericSetting(model, "inputTokensPerMinute") ?? defaults.inputTokensPerMinute,
    minDelayMs: getNumericSetting(model, "minDelayMs") ?? defaults.minDelayMs ?? 0
  };
}

function getRateLimitState(key: string) {
  const existing = rateLimitStates.get(key);
  if (existing) {
    return existing;
  }

  const state: RateLimitState = {
    requestTimestamps: [],
    tokenReservations: [],
    nextAvailableAt: 0
  };

  rateLimitStates.set(key, state);
  return state;
}

function pruneRateLimitState(state: RateLimitState, now: number) {
  while (state.requestTimestamps.length > 0 && now - state.requestTimestamps[0] >= ONE_MINUTE_MS) {
    state.requestTimestamps.shift();
  }

  while (state.tokenReservations.length > 0 && now - state.tokenReservations[0].timestamp >= ONE_MINUTE_MS) {
    state.tokenReservations.shift();
  }
}

async function waitForRateLimitWindow(model: ModelDefinition, body: Record<string, unknown>) {
  const budget = getRateLimitBudget(model);
  if (!budget.requestsPerMinute && !budget.inputTokensPerMinute && !budget.minDelayMs) {
    return;
  }

  const state = getRateLimitState(`${model.provider}:${model.model}`);
  const estimatedTokens = estimateInputTokens(body);

  while (true) {
    const now = Date.now();
    pruneRateLimitState(state, now);

    let waitMs = Math.max(0, state.nextAvailableAt - now);

    if (budget.requestsPerMinute && state.requestTimestamps.length >= budget.requestsPerMinute) {
      waitMs = Math.max(waitMs, ONE_MINUTE_MS - (now - state.requestTimestamps[0]));
    }

    if (budget.inputTokensPerMinute) {
      const reservedTokens = state.tokenReservations.reduce((sum, entry) => sum + entry.tokens, 0);
      if (reservedTokens + estimatedTokens > budget.inputTokensPerMinute) {
        let runningTokens = reservedTokens;
        for (const entry of state.tokenReservations) {
          runningTokens -= entry.tokens;
          if (runningTokens + estimatedTokens <= budget.inputTokensPerMinute) {
            waitMs = Math.max(waitMs, ONE_MINUTE_MS - (now - entry.timestamp));
            break;
          }
        }
      }
    }

    if (waitMs > 0) {
      await sleep(waitMs);
      continue;
    }

    state.requestTimestamps.push(now);
    state.tokenReservations.push({ timestamp: now, tokens: estimatedTokens });
    state.nextAvailableAt = now + (budget.minDelayMs ?? 0);
    return;
  }
}

function isRetriableModelError(message: string) {
  return /Model request failed:\s*(429|500|502|503|504)\b/.test(message);
}

async function createChatCompletion(
  model: ModelDefinition,
  body: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
  defaultHeaders?: Record<string, string>
) {
  await waitForRateLimitWindow(model, body);

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
        reasoning_content?: string | null;
      };
    }>;
  };
}

async function createChatCompletionWithRetry(
  model: ModelDefinition,
  body: Record<string, unknown>,
  apiKey: string,
  baseUrl: string,
  defaultHeaders?: Record<string, string>
) {
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await createChatCompletion(model, body, apiKey, baseUrl, defaultHeaders);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (attempt >= maxAttempts || !isRetriableModelError(message)) {
        throw error;
      }

      await sleep(400 * attempt);
    }
  }

  throw new Error("Model request failed after retries.");
}

async function requestFinalJson(
  params: {
    definition: ModelDefinition;
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
      params.definition,
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

    return createChatCompletionWithRetry(
      params.definition,
      {
        model: params.model,
        temperature: params.temperature,
        messages: finalMessages,
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
    const trace: ModelTraceEvent[] = [];
    const systemPrompt = buildSystemPrompt(input, maxToolRounds);
    const userPrompt = buildUserPrompt(input);
    const currentGameId = input.currentGame?.game.id ?? "game";

    const messages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ];
    trace.push(traceEvent(`${currentGameId}-system`, "system_prompt", { content: systemPrompt }));
    trace.push(traceEvent(`${currentGameId}-user`, "user_prompt", { content: userPrompt }));

    const tools = mapTools(input);

    for (let step = 0; step < maxToolRounds; step += 1) {
      const payload = await createChatCompletionWithRetry(
        model,
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
        trace.push(
          traceEvent(`${currentGameId}-assistant-${step}`, "assistant_message", {
            content: message.reasoning_content
              ? `${message.reasoning_content}\n\n${message.content ?? ""}`.trim()
              : message.content ?? null
          })
        );
        messages.push({
          role: "assistant",
          content: message.content ?? null,
          tool_calls: message.tool_calls,
          reasoning_content: message.reasoning_content ?? null
        });

        for (const [toolIndex, toolCall] of message.tool_calls.entries()) {
          const args = toolCall.function.arguments ? JSON.parse(toolCall.function.arguments) : {};
          trace.push(
            traceEvent(`${currentGameId}-tool-call-${step}-${toolIndex}`, "tool_call", {
              toolName: toolCall.function.name,
              arguments: args,
              content: message.content ?? null
            })
          );
          const result = await input.tools.invoke(toolCall.function.name, args);
          const serializedResult = serializeToolResultForModel(toolCall.function.name, result);
          trace.push(
            traceEvent(`${currentGameId}-tool-result-${step}-${toolIndex}`, "tool_result", {
              toolName: toolCall.function.name,
              result,
              content: serializedResult
            })
          );
          messages.push({
            role: "tool",
            tool_call_id: toolCall.id,
            content: serializedResult
          });
        }

        if (step === maxToolRounds - 1) {
          const finalPayload = await requestFinalJson(
            {
              definition: model,
              model: model.model,
              temperature: Number(model.settings?.temperature ?? 0.2),
              messages
            },
            runtime
          );

          const content = finalPayload.choices?.[0]?.message?.content;
          if (!content) {
            throw new Error("Model returned no final JSON content after max tool rounds.");
          }

          trace.push(traceEvent(`${currentGameId}-final-json`, "final_json", { content }));

          const parsed = JSON.parse(extractJsonObject(content)) as {
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

          return {
            ...parsed,
            modelTrace: trace
          };
        }

        continue;
      }

      trace.push(
        traceEvent(`${currentGameId}-assistant-final-${step}`, "assistant_message", {
          content: message.reasoning_content
            ? `${message.reasoning_content}\n\n${message.content ?? ""}`.trim()
            : message.content ?? ""
        })
      );

      const finalPayload = await requestFinalJson(
        {
          definition: model,
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

      trace.push(traceEvent(`${currentGameId}-final-json`, "final_json", { content }));

      const parsed = JSON.parse(extractJsonObject(content)) as {
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

      return {
        ...parsed,
        modelTrace: trace
      };
    }

    throw new Error(`Model exceeded max tool rounds (${maxToolRounds}) without producing a final answer.`);
  }
}
