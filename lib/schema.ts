import { z } from "zod";

export const teamSchema = z.object({
  id: z.string(),
  name: z.string(),
  shortName: z.string(),
  seed: z.number().int(),
  region: z.string(),
  conference: z.string().optional(),
  metrics: z.record(z.number()).optional()
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
  provider: z.enum(["mock", "openai-compatible"]),
  model: z.string(),
  description: z.string().optional(),
  settings: z.record(z.union([z.number(), z.string(), z.boolean()])).optional()
});

export const bracketSubmissionSchema = z.object({
  runId: z.string(),
  model: modelDefinitionSchema,
  generatedAt: z.string(),
  configId: z.string(),
  picks: z.array(
    z.object({
      gameId: z.string(),
      winnerId: z.string(),
      confidence: z.number().min(0).max(1),
      rationale: z.string()
    })
  ),
  reasoning: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      summary: z.string(),
      evidence: z.array(z.string())
    })
  ),
  sources: z.array(
    z.object({
      id: z.string(),
      title: z.string(),
      collectedAt: z.string(),
      payload: z.any()
    })
  )
});

export const actualResultsSchema = z.object({
  configId: z.string(),
  results: z.array(
    z.object({
      gameId: z.string(),
      winnerId: z.string()
    })
  )
});
