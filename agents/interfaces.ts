import {
  AgentToolCall,
  AgentToolDefinition,
  BracketConfig,
  BracketPick,
  BracketSubmission,
  GamePredictionContext,
  ModelDefinition
} from "@/lib/types";

export interface PredictionInput {
  config: BracketConfig;
  tools: ToolRuntime;
  priorPicks: BracketPick[];
  currentGame?: GamePredictionContext;
}

export interface ModelAdapter {
  predictGame(
    input: PredictionInput,
    model: ModelDefinition
  ): Promise<{
    pick: BracketPick;
    reasoningStep?: {
      id: string;
      title: string;
      summary: string;
      evidence: string[];
    };
  }>;
}

export interface AgentTool {
  definition: AgentToolDefinition;
  execute(args: unknown, input: PredictionInput): Promise<{ summary: string; result: unknown }>;
}

export interface ToolRuntime {
  list(): AgentToolDefinition[];
  invoke(name: string, args: unknown): Promise<unknown>;
  transcript(): AgentToolCall[];
  updateContext(context: Pick<PredictionInput, "priorPicks" | "currentGame">): void;
}

export interface ToolRuntimeOptions {
  onToolCall?: (call: AgentToolCall) => void | Promise<void>;
}
