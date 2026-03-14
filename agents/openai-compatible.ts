import { ModelDefinition } from "@/lib/types";
import { ModelAdapter, PredictionInput } from "@/agents/interfaces";

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

function buildSystemPrompt(input: PredictionInput) {
  const currentGame = input.currentGame;
  if (!currentGame) {
    throw new Error("OpenAICompatibleAdapter requires currentGame.");
  }

  return [
    "You are an analyst predicting a single March Madness game inside a bracket run.",
    "You have live tools. Use them before making a pick when they can reduce uncertainty.",
    "You are not filling the whole bracket in one response. Predict only the current game.",
    "Use prior picks as already committed bracket state.",
    "Return strict JSON only.",
    "Final JSON keys: pick, reasoningStep.",
    "pick must contain gameId, winnerId, confidence, rationale.",
    "The rationale must be a short paragraph of 2 to 4 sentences explaining why the winner was chosen.",
    "reasoningStep must contain id, title, summary, evidence.",
    `Bracket config id: ${input.config.id}`,
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

async function createChatCompletion(body: Record<string, unknown>, apiKey: string, baseUrl: string) {
  const response = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`
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

export class OpenAICompatibleAdapter implements ModelAdapter {
  async predictGame(input: PredictionInput, model: ModelDefinition) {
    const apiKey = process.env.OPENAI_API_KEY;
    const baseUrl = process.env.OPENAI_BASE_URL ?? "https://api.openai.com/v1";

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is required for openai-compatible models.");
    }

    const messages: ChatMessage[] = [
      { role: "system", content: buildSystemPrompt(input) },
      { role: "user", content: buildUserPrompt(input) }
    ];

    const tools = mapTools(input);
    const maxToolRounds = Number(model.settings?.maxToolRounds ?? 6);

    for (let step = 0; step < maxToolRounds; step += 1) {
      const payload = await createChatCompletion(
        {
          model: model.model,
          temperature: Number(model.settings?.temperature ?? 0.2),
          messages,
          tools,
          tool_choice: "auto"
        },
        apiKey,
        baseUrl
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
            content: JSON.stringify(result)
          });
        }

        continue;
      }

      const finalPayload = await createChatCompletion(
        {
          model: model.model,
          temperature: Number(model.settings?.temperature ?? 0.2),
          messages: [
            ...messages,
            {
              role: "assistant",
              content: message.content ?? ""
            },
            {
              role: "user",
              content:
                "Return the final answer now as strict JSON only with keys pick and reasoningStep. The pick.rationale must be a short paragraph."
            }
          ],
          response_format: { type: "json_object" }
        },
        apiKey,
        baseUrl
      );

      const content = finalPayload.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error("Model returned no final JSON content.");
      }

      return JSON.parse(content) as {
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
