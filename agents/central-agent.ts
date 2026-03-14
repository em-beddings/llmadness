import { ModelAdapter } from "@/agents/interfaces";
import { createDefaultTools } from "@/agents/tools";
import { ROUND_ORDER, indexTeams, resolveCompetitorName } from "@/lib/bracket";
import { BracketConfig, BracketPick, BracketSubmission, ModelDefinition, ReasoningStep } from "@/lib/types";

export class CentralBracketAgent {
  constructor(private readonly adapters: Record<string, ModelAdapter>) {}

  async run(runId: string, config: BracketConfig, model: ModelDefinition): Promise<BracketSubmission> {
    const adapter = this.adapters[model.provider];
    if (!adapter) {
      throw new Error(`No adapter registered for provider "${model.provider}"`);
    }

    const tools = createDefaultTools(config);
    const teamIndex = indexTeams(config);
    const picks: BracketPick[] = [];
    const reasoning: ReasoningStep[] = [];
    const winners = new Map<string, string>();

    const orderedGames = ROUND_ORDER.flatMap((round) => config.games.filter((game) => game.round === round));

    for (const game of orderedGames) {
      const slotATeamId = game.slotA.kind === "team" ? game.slotA.teamId : winners.get(game.slotA.gameId);
      const slotBTeamId = game.slotB.kind === "team" ? game.slotB.teamId : winners.get(game.slotB.gameId);

      if (!slotATeamId || !slotBTeamId) {
        throw new Error(`Unable to resolve both competitors for game ${game.id}`);
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

      picks.push(result.pick);
      winners.set(game.id, result.pick.winnerId);

      if (result.reasoningStep) {
        reasoning.push(result.reasoningStep);
      }
    }

    return {
      configId: config.id,
      model,
      picks,
      reasoning,
      runId,
      generatedAt: new Date().toISOString(),
      toolCalls: tools.transcript()
    };
  }
}
