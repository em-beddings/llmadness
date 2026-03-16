import { z } from "zod";

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  seed: z.number().int(),
  region: z.string(),
  conference: z.string().optional()
});

export const competitorRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("team"),
    teamId: z.string()
  }),
  z.object({
    kind: z.literal("winner"),
    gameId: z.string()
  })
]);

export const gameDefinitionSchema = z.object({
  id: z.string(),
  round: z.enum([
    "First Four",
    "Round of 64",
    "Round of 32",
    "Sweet 16",
    "Elite 8",
    "Final Four",
    "Championship"
  ]),
  region: z.string().optional(),
  label: z.string(),
  slotA: competitorRefSchema,
  slotB: competitorRefSchema
});

export const bracketConfigSchema = z.object({
  id: z.string(),
  title: z.string(),
  year: z.number().int(),
  division: z.enum(["mens", "womens"]),
  publishedAt: z.string().optional(),
  teams: z.array(teamSchema),
  games: z.array(gameDefinitionSchema)
});

export const modelDefinitionSchema = z.object({
  id: z.string(),
  label: z.string(),
  provider: z.enum([
    "mock",
    "openai",
    "anthropic",
    "google-gemini",
    "xai",
    "moonshot",
    "qwen",
    "deepseek",
    "mimo"
  ]),
  model: z.string(),
  description: z.string().optional(),
  settings: z.record(z.union([z.number(), z.string(), z.boolean()])).optional()
});

export const agentToolCallSchema = z.object({
  id: z.string(),
  toolName: z.string(),
  arguments: z.any(),
  startedAt: z.string(),
  completedAt: z.string(),
  summary: z.string(),
  result: z.any()
});

export const modelTraceEventSchema = z.object({
  id: z.string(),
  type: z.enum([
    "system_prompt",
    "user_prompt",
    "assistant_message",
    "tool_call",
    "tool_result",
    "final_json"
  ]),
  createdAt: z.string(),
  content: z.string().nullable().optional(),
  toolName: z.string().optional(),
  arguments: z.any().optional(),
  result: z.any().optional()
});

export const reasoningStepSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  evidence: z.array(z.string())
});

export const bracketPickSchema = z.object({
  gameId: z.string(),
  winnerId: z.string(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().min(40)
});

export const gameRunArtifactSchema = z.object({
  runId: z.string(),
  configId: z.string(),
  model: modelDefinitionSchema,
  gameId: z.string(),
  generatedAt: z.string(),
  pick: bracketPickSchema,
  reasoningStep: reasoningStepSchema.optional(),
  toolCalls: z.array(agentToolCallSchema).default([]),
  modelTrace: z.array(modelTraceEventSchema).default([])
});

export const bracketSubmissionSchema = z.object({
  runId: z.string(),
  model: modelDefinitionSchema,
  generatedAt: z.string(),
  configId: z.string(),
  picks: z.array(bracketPickSchema),
  reasoning: z.array(reasoningStepSchema),
  toolCalls: z.array(agentToolCallSchema).default([]),
  gameRuns: z.array(gameRunArtifactSchema).default([])
});

export const actualResultsSchema = z.object({
  configId: z.string(),
  results: z.array(
    z.object({
      gameId: z.string(),
      winnerId: z.string().optional()
    })
  )
});
