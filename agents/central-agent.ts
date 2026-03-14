import { DataSource, ModelAdapter } from "@/agents/interfaces";
import { BracketConfig, BracketSubmission, ModelDefinition } from "@/lib/types";

export class CentralBracketAgent {
  constructor(
    private readonly dataSources: DataSource[],
    private readonly adapters: Record<string, ModelAdapter>
  ) {}

  async run(runId: string, config: BracketConfig, model: ModelDefinition): Promise<BracketSubmission> {
    const adapter = this.adapters[model.provider];
    if (!adapter) {
      throw new Error(`No adapter registered for provider "${model.provider}"`);
    }

    const sources = await Promise.all(this.dataSources.map((source) => source.collect(config)));
    const submission = await adapter.generateBracket({ config, sources }, model);

    return {
      ...submission,
      runId,
      generatedAt: new Date().toISOString()
    };
  }
}
