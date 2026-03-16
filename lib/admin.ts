import path from "node:path";
import { readdir } from "node:fs/promises";
import { createDefaultTools } from "@/agents/tools";
import { createModelAdapters } from "@/lib/model-adapters";
import { resolveModelDefinition } from "@/lib/model-runtime";
import { indexTeams } from "@/lib/bracket";
import { readJsonFile, writeJsonFile } from "@/lib/fs";
import { bracketConfigSchema, modelDefinitionSchema } from "@/lib/schema";
import { BracketConfig, ModelDefinition, TournamentRound } from "@/lib/types";

const ROOT = process.cwd();
const CONFIGS_DIR = path.join(ROOT, "data", "configs");
const MODELS_DIR = path.join(ROOT, "data", "models");
const ADMIN_JOBS_DIR = path.join(ROOT, "data", "admin-jobs");

export interface AdminConfigOption {
  file: string;
  id: string;
  title: string;
  teams: Array<{
    id: string;
    name: string;
    region: string;
    seed: number;
  }>;
}

export interface AdminModelOption {
  key: string;
  file: string;
  id: string;
  label: string;
  provider: string;
  model: string;
}

export interface AdminPredictionResult {
  model: {
    id: string;
    label: string;
    provider: string;
    model: string;
  };
  game: {
    label: string;
    round: TournamentRound;
    slotA: string;
    slotB: string;
  };
  pick: {
    winnerId: string;
    winnerName: string;
    confidence: number;
    rationale: string;
  };
  reasoningStep?: {
    id: string;
    title: string;
    summary: string;
    evidence: string[];
  };
  toolCalls: Array<{
    id: string;
    toolName: string;
    summary: string;
    startedAt: string;
    completedAt: string;
    arguments: unknown;
    result: unknown;
  }>;
}

export interface AdminRunEvent {
  id: string;
  timestamp: string;
  message: string;
}

export interface AdminRunJob {
  id: string;
  status: "pending" | "running" | "completed" | "error";
  createdAt: string;
  updatedAt: string;
  input: {
    configFile: string;
    modelKey: string;
    round: TournamentRound;
    slotATeamId: string;
    slotBTeamId: string;
    label?: string;
  };
  events: AdminRunEvent[];
  toolCalls: AdminPredictionResult["toolCalls"];
  result?: AdminPredictionResult;
  error?: string;
}

function makeJobId() {
  return `admin-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function makeEvent(message: string): AdminRunEvent {
  return {
    id: `event-${Math.random().toString(36).slice(2, 10)}`,
    timestamp: new Date().toISOString(),
    message
  };
}

function jobPath(jobId: string) {
  return path.join(ADMIN_JOBS_DIR, `${jobId}.json`);
}

async function listJsonFiles(dir: string) {
  const entries = await readdir(dir, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.endsWith(".json")).map((entry) => entry.name);
}

export async function loadAdminData() {
  const [configFiles, modelFiles] = await Promise.all([listJsonFiles(CONFIGS_DIR), listJsonFiles(MODELS_DIR)]);

  const configs = await Promise.all(
    configFiles.map(async (file) => {
      const config = bracketConfigSchema.parse(await readJsonFile<BracketConfig>(path.join(CONFIGS_DIR, file)));
      return {
        file,
        id: config.id,
        title: config.title,
        teams: config.teams.map((team) => ({
          id: team.id,
          name: team.name,
          region: team.region,
          seed: team.seed
        }))
      } satisfies AdminConfigOption;
    })
  );

  const modelMap = new Map<string, AdminModelOption>();
  for (const file of modelFiles) {
    const models = modelDefinitionSchema.array().parse(await readJsonFile<ModelDefinition[]>(path.join(MODELS_DIR, file)));
    for (const rawModel of models) {
      const key = `${file}::${rawModel.id}`;
      const existing = modelMap.get(rawModel.id);
      const option = {
        key,
        file,
        id: rawModel.id,
        label: rawModel.label,
        provider: rawModel.provider,
        model: rawModel.model
      } satisfies AdminModelOption;

      if (!existing || (existing.provider === "mock" && rawModel.provider !== "mock")) {
        modelMap.set(rawModel.id, option);
      } else if (!modelMap.has(key)) {
        modelMap.set(key, option);
      }
    }
  }

  return {
    configs: configs.sort((a, b) => a.title.localeCompare(b.title)),
    models: Array.from(modelMap.values()).sort((a, b) => a.label.localeCompare(b.label))
  };
}

export async function loadAdminJob(jobId: string) {
  return readJsonFile<AdminRunJob>(jobPath(jobId));
}

async function saveAdminJob(job: AdminRunJob) {
  job.updatedAt = new Date().toISOString();
  await writeJsonFile(jobPath(job.id), job);
}

async function loadModelByKey(modelKey: string) {
  const [file, modelId] = modelKey.split("::");
  if (!file || !modelId) {
    throw new Error("Invalid model selection.");
  }

  const models = modelDefinitionSchema.array().parse(await readJsonFile<ModelDefinition[]>(path.join(MODELS_DIR, file)));
  const model = models.find((entry) => entry.id === modelId);
  if (!model) {
    throw new Error(`Model "${modelId}" not found in ${file}.`);
  }

  return resolveModelDefinition(model);
}

export async function runAdminPrediction(
  input: {
    configFile: string;
    modelKey: string;
    round: TournamentRound;
    slotATeamId: string;
    slotBTeamId: string;
    label?: string;
  },
  options?: {
    onEvent?: (message: string) => Promise<void> | void;
    onToolCalls?: (toolCalls: AdminPredictionResult["toolCalls"]) => Promise<void> | void;
  }
): Promise<AdminPredictionResult> {
  const config = bracketConfigSchema.parse(await readJsonFile<BracketConfig>(path.join(CONFIGS_DIR, input.configFile)));
  const model = await loadModelByKey(input.modelKey);
  const teamIndex = indexTeams(config);
  const teamA = teamIndex.get(input.slotATeamId);
  const teamB = teamIndex.get(input.slotBTeamId);

  if (!teamA || !teamB) {
    throw new Error("Both teams must exist in the selected config.");
  }

  if (teamA.id === teamB.id) {
    throw new Error("Choose two different teams.");
  }

  await options?.onEvent?.(`Loaded ${config.title}.`);
  await options?.onEvent?.(`Running ${model.label} on ${teamA.name} vs ${teamB.name}.`);

  const adapters = createModelAdapters();
  const adapter = adapters[model.provider];
  if (!adapter) {
    throw new Error(`No adapter registered for provider "${model.provider}".`);
  }

  const game = {
    id: "admin-preview",
    round: input.round,
    label: input.label?.trim() || `${teamA.name} vs ${teamB.name}`,
    slotA: { kind: "team" as const, teamId: teamA.id },
    slotB: { kind: "team" as const, teamId: teamB.id }
  };

  let toolCalls: AdminPredictionResult["toolCalls"] = [];
  const tools = createDefaultTools(config, {
    onToolCall: async () => {
      toolCalls = tools.transcript();
      await options?.onToolCalls?.(toolCalls);
      const latest = toolCalls.at(-1);
      if (latest) {
        await options?.onEvent?.(`Tool: ${latest.toolName} - ${latest.summary}`);
      }
    }
  });
  const currentGame = {
    game,
    slotAName: teamA.name,
    slotBName: teamB.name,
    slotATeamId: teamA.id,
    slotBTeamId: teamB.id,
    priorPicks: []
  };

  tools.updateContext({
    priorPicks: [],
    currentGame
  });

  const result = await adapter.predictGame(
    {
      config,
      tools,
      priorPicks: [],
      currentGame
    },
    model
  );

  if (![teamA.id, teamB.id].includes(result.pick.winnerId)) {
    throw new Error(`Model returned invalid winner "${result.pick.winnerId}".`);
  }

  const winner = teamIndex.get(result.pick.winnerId);
  await options?.onEvent?.(`Completed prediction. Winner: ${winner?.name ?? result.pick.winnerId}.`);

  return {
    model: {
      id: model.id,
      label: model.label,
      provider: model.provider,
      model: model.model
    },
    game: {
      label: game.label,
      round: game.round,
      slotA: teamA.name,
      slotB: teamB.name
    },
    pick: {
      winnerId: result.pick.winnerId,
      winnerName: winner?.name ?? result.pick.winnerId,
      confidence: result.pick.confidence,
      rationale: result.pick.rationale
    },
    reasoningStep: result.reasoningStep,
    toolCalls
  };
}

export async function createAdminRunJob(input: {
  configFile: string;
  modelKey: string;
  round: TournamentRound;
  slotATeamId: string;
  slotBTeamId: string;
  label?: string;
}) {
  const now = new Date().toISOString();
  const job: AdminRunJob = {
    id: makeJobId(),
    status: "pending",
    createdAt: now,
    updatedAt: now,
    input,
    events: [makeEvent("Job created.")],
    toolCalls: []
  };

  await saveAdminJob(job);

  void (async () => {
    try {
      job.status = "running";
      job.events.push(makeEvent("Job started."));
      await saveAdminJob(job);

      const result = await runAdminPrediction(input, {
        onEvent: async (message) => {
          job.events.push(makeEvent(message));
          await saveAdminJob(job);
        },
        onToolCalls: async (toolCalls) => {
          job.toolCalls = toolCalls;
          await saveAdminJob(job);
        }
      });

      job.status = "completed";
      job.result = result;
      job.toolCalls = result.toolCalls;
      job.events.push(makeEvent("Job finished."));
      await saveAdminJob(job);
    } catch (error) {
      job.status = "error";
      job.error = error instanceof Error ? error.message : "Admin prediction failed.";
      job.events.push(makeEvent(job.error));
      await saveAdminJob(job);
    }
  })();

  return job;
}
