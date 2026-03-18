export type TournamentRound =
  | "First Four"
  | "Round of 64"
  | "Round of 32"
  | "Sweet 16"
  | "Elite 8"
  | "Final Four"
  | "Championship";

export type Seed = number;

export interface Team {
  id: string;
  name: string;
  shortName: string;
  seed: Seed;
  region: string;
  conference?: string;
}

export interface TeamRef {
  kind: "team";
  teamId: string;
}

export interface WinnerRef {
  kind: "winner";
  gameId: string;
}

export type CompetitorRef = TeamRef | WinnerRef;

export interface GameDefinition {
  id: string;
  round: TournamentRound;
  region?: string;
  label: string;
  slotA: CompetitorRef;
  slotB: CompetitorRef;
}

export interface BracketConfig {
  id: string;
  title: string;
  year: number;
  division: "mens" | "womens";
  publishedAt?: string;
  teams: Team[];
  games: GameDefinition[];
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface AgentToolCall {
  id: string;
  toolName: string;
  arguments: unknown;
  startedAt: string;
  completedAt: string;
  summary: string;
  result: unknown;
}

export interface ModelTraceEvent {
  id: string;
  type:
    | "system_prompt"
    | "user_prompt"
    | "assistant_message"
    | "tool_call"
    | "tool_result"
    | "final_json";
  createdAt: string;
  content?: string | null;
  toolName?: string;
  arguments?: unknown;
  result?: unknown;
}

export type ModelProvider =
  | "mock"
  | "openai"
  | "anthropic"
  | "google-gemini"
  | "xai"
  | "moonshot"
  | "qwen"
  | "deepseek"
  | "mimo";

export interface ModelDefinition {
  id: string;
  label: string;
  provider: ModelProvider;
  model: string;
  description?: string;
  settings?: Record<string, number | string | boolean>;
}

export interface ReasoningStep {
  id: string;
  title: string;
  summary: string;
  evidence: string[];
}

export interface BracketPick {
  gameId: string;
  winnerId: string;
  confidence: number;
  rationale: string;
}

export interface GamePredictionContext {
  game: GameDefinition;
  slotAName: string;
  slotBName: string;
  slotATeamId: string;
  slotBTeamId: string;
  priorPicks: BracketPick[];
}

export interface BracketSubmission {
  runId: string;
  model: ModelDefinition;
  generatedAt: string;
  configId: string;
  picks: BracketPick[];
  reasoning: ReasoningStep[];
  toolCalls: AgentToolCall[];
  gameRuns: GameRunArtifact[];
}

export interface GameRunArtifact {
  runId: string;
  configId: string;
  model: ModelDefinition;
  gameId: string;
  generatedAt: string;
  pick: BracketPick;
  reasoningStep?: ReasoningStep;
  toolCalls: AgentToolCall[];
  modelTrace: ModelTraceEvent[];
}

export interface ActualResults {
  configId: string;
  results: Array<{
    gameId: string;
    winnerId?: string;
  }>;
}

export interface GameScore {
  gameId: string;
  round: TournamentRound;
  correct: boolean;
  pointsAwarded: number;
}

export interface LeaderboardEntry {
  modelId: string;
  modelLabel: string;
  totalPoints: number;
  maxPoints: number;
  pointsRemaining: number;
  accuracy: number;
  gameScores: GameScore[];
}

export interface Leaderboard {
  runId: string;
  scoredAt: string;
  entries: LeaderboardEntry[];
}
