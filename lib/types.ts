export type TournamentRound =
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
  metrics?: Record<string, number>;
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

export interface DataSourceSnapshot {
  id: string;
  title: string;
  collectedAt: string;
  payload: unknown;
}

export interface ModelDefinition {
  id: string;
  label: string;
  provider: "mock" | "openai-compatible";
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

export interface BracketSubmission {
  runId: string;
  model: ModelDefinition;
  generatedAt: string;
  configId: string;
  picks: BracketPick[];
  reasoning: ReasoningStep[];
  sources: DataSourceSnapshot[];
}

export interface ActualResults {
  configId: string;
  results: Array<{
    gameId: string;
    winnerId: string;
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
  accuracy: number;
  gameScores: GameScore[];
}

export interface Leaderboard {
  runId: string;
  scoredAt: string;
  entries: LeaderboardEntry[];
}
