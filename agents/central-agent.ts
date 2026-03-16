import path from "node:path";
import { ModelAdapter } from "@/agents/interfaces";
import { createDefaultTools } from "@/agents/tools";
import { ROUND_ORDER, indexTeams, resolveCompetitorName } from "@/lib/bracket";
import { readJsonFile, writeJsonFile } from "@/lib/fs";
import { gameRunArtifactSchema } from "@/lib/schema";
import {
  BracketConfig,
  BracketPick,
  BracketSubmission,
  GameRunArtifact,
  ModelDefinition,
  ReasoningStep
} from "@/lib/types";

async function readExistingGameRun(filePath: string) {
  try {
    return gameRunArtifactSchema.parse(await readJsonFile<GameRunArtifact>(filePath)) as GameRunArtifact;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

export class CentralBracketAgent {
  constructor(private readonly adapters: Record<string, ModelAdapter>) {}

  async run(runId: string, config: BracketConfig, model: ModelDefinition): Promise<BracketSubmission> {
    const adapter = this.adapters[model.provider];
    if (!adapter) {
      throw new Error(`No adapter registered for provider "${model.provider}"`);
    }

    const tools = createDefaultTools(config);
    const picks: BracketPick[] = [];
    const reasoning: ReasoningStep[] = [];
    const gameRuns: GameRunArtifact[] = [];
    const winners = new Map<string, string>();
    const runRoot = path.join(process.cwd(), "data", "runs", runId, model.id);

    const orderedGames = ROUND_ORDER.flatMap((round) => config.games.filter((game) => game.round === round));

    for (const game of orderedGames) {
      const slotATeamId = game.slotA.kind === "team" ? game.slotA.teamId : winners.get(game.slotA.gameId);
      const slotBTeamId = game.slotB.kind === "team" ? game.slotB.teamId : winners.get(game.slotB.gameId);

      if (!slotATeamId || !slotBTeamId) {
        throw new Error(`Unable to resolve both competitors for game ${game.id}`);
      }

      const gameRunPath = path.join(runRoot, "games", `${game.id}.json`);
      const existingGameRun = await readExistingGameRun(gameRunPath);
      if (existingGameRun) {
        picks.push(existingGameRun.pick);
        winners.set(game.id, existingGameRun.pick.winnerId);
        if (existingGameRun.reasoningStep) {
          reasoning.push(existingGameRun.reasoningStep);
        }
        gameRuns.push(existingGameRun);
        continue;
      }

      const currentGame = {
        game,
        slotAName: resolveCompetitorName(config, { kind: "team", teamId: slotATeamId }, winners),
        slotBName: resolveCompetitorName(config, { kind: "team", teamId: slotBTeamId }, winners),
        slotATeamId,
        slotBTeamId,
        priorPicks: picks
      };

      tools.updateContext({
        priorPicks: picks,
        currentGame
      });

      const priorToolCallCount = tools.transcript().length;
      const result = await adapter.predictGame(
        {
          config,
          tools,
          priorPicks: picks,
          currentGame
        },
        model
      );

      if (![slotATeamId, slotBTeamId].includes(result.pick.winnerId)) {
        throw new Error(`Model selected invalid winner ${result.pick.winnerId} for game ${game.id}`);
      }

      if (result.pick.rationale.trim().length < 40) {
        throw new Error(`Model returned an insufficient rationale for game ${game.id}`);
      }

      const gameRun: GameRunArtifact = {
        runId,
        configId: config.id,
        model,
        gameId: game.id,
        generatedAt: new Date().toISOString(),
        pick: result.pick,
        reasoningStep: result.reasoningStep,
        toolCalls: tools.transcript().slice(priorToolCallCount),
        modelTrace: result.modelTrace ?? []
      };

      await writeJsonFile(gameRunPath, gameRun);

      picks.push(result.pick);
      winners.set(game.id, result.pick.winnerId);
      gameRuns.push(gameRun);

      if (result.reasoningStep) {
        reasoning.push(result.reasoningStep);
      }
    }

    const submission: BracketSubmission = {
      configId: config.id,
      model,
      picks,
      reasoning,
      runId,
      generatedAt: new Date().toISOString(),
      toolCalls: gameRuns.flatMap((gameRun) => gameRun.toolCalls),
      gameRuns
    };

    await writeJsonFile(path.join(process.cwd(), "data", "runs", runId, `${model.id}.json`), submission);

    return submission;
  }
}
