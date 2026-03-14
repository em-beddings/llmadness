import { BracketConfig, BracketSubmission, DataSourceSnapshot, ModelDefinition } from "@/lib/types";

export interface PredictionInput {
  config: BracketConfig;
  sources: DataSourceSnapshot[];
}

export interface ModelAdapter {
  generateBracket(input: PredictionInput, model: ModelDefinition): Promise<Omit<BracketSubmission, "runId" | "generatedAt">>;
}

export interface DataSource {
  id: string;
  title: string;
  collect(config: BracketConfig): Promise<DataSourceSnapshot>;
}
