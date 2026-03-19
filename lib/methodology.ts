export const LIVE_TOOL_NAMES = [
  "list_teams",
  "get_games",
  "lookup_cbb_ratings",
  "search_web",
  "search_espn_news",
  "fetch_webpage"
] as const;

export const SYSTEM_PROMPT_RULES = [
  "You are an analyst predicting a single March Madness game inside a bracket run.",
  "You have live tools. Use them before making a pick when they can reduce uncertainty.",
  "You are not filling the whole bracket in one response. Predict only the current game.",
  "Use prior picks as already committed bracket state.",
  "Before making a pick, investigate relevant context such as injuries or availability concerns, recent team news, prior head-to-head results when useful, and multiple raw statistics from the available ratings and matchup data.",
  "Take a holistic approach. Balance team quality, matchup specifics, health, form, schedule context, and upset risk instead of relying on one metric.",
  "Do not force an upset, but explicitly consider whether the underdog has a credible path to win and let that affect confidence and rationale.",
  "Return strict JSON only.",
  "Final JSON keys: pick, reasoningStep.",
  "pick must contain gameId, winnerId, confidence, rationale.",
  "The rationale must be a short paragraph of 2 to 4 sentences explaining why the winner was chosen.",
  "reasoningStep must contain id, title, summary, evidence."
] as const;

export const USER_PROMPT_RULES = [
  "Predict the winner of the current game only.",
  "Use only one of the two resolved team IDs as winnerId.",
  "The prior picks are the committed winners of earlier rounds and define the matchup path.",
  "Write the pick rationale as a short paragraph, not bullets or fragments."
] as const;

export function renderSystemPrompt(maxToolRounds: number, context: {
  configId: string;
  year: number;
  gameId: string;
  gameLabel: string;
  round: string;
  slotAName: string;
  slotATeamId: string;
  slotBName: string;
  slotBTeamId: string;
  priorPickCount: number;
}) {
  return [
    ...SYSTEM_PROMPT_RULES.slice(0, 4),
    `You may use at most ${maxToolRounds} tool rounds before you must finalize your answer.`,
    ...SYSTEM_PROMPT_RULES.slice(4),
    `Bracket config id: ${context.configId}`,
    `Tournament year: ${context.year}`,
    `Current game id: ${context.gameId}`,
    `Current game label: ${context.gameLabel}`,
    `Round: ${context.round}`,
    `Resolved teams: ${context.slotAName} (${context.slotATeamId}) vs ${context.slotBName} (${context.slotBTeamId})`,
    `Prior committed picks: ${context.priorPickCount}`
  ].join("\n");
}

export function renderUserPrompt(payload: {
  currentGame: unknown;
  priorPicks: unknown[];
  configId: string;
}) {
  return [
    ...USER_PROMPT_RULES,
    "",
    JSON.stringify(
      {
        currentGame: payload.currentGame,
        priorPicks: payload.priorPicks,
        configId: payload.configId
      },
      null,
      2
    )
  ].join("\n");
}

export function renderSystemPromptTemplate(maxToolRounds = 10) {
  return renderSystemPrompt(maxToolRounds, {
    configId: "2026-bracket",
    year: 2026,
    gameId: "r64-east-1",
    gameLabel: "East Round of 64 1",
    round: "Round of 64",
    slotAName: "Duke",
    slotATeamId: "duke",
    slotBName: "Siena",
    slotBTeamId: "siena",
    priorPickCount: 4
  });
}

export function renderUserPromptTemplate() {
  return renderUserPrompt({
    currentGame: {
      game: {
        id: "r64-east-1",
        round: "Round of 64",
        region: "East",
        label: "East Round of 64 1",
        slotA: {
          kind: "team",
          teamId: "duke"
        },
        slotB: {
          kind: "team",
          teamId: "siena"
        }
      },
      slotAName: "Duke",
      slotBName: "Siena",
      slotATeamId: "duke",
      slotBTeamId: "siena"
    },
    priorPicks: [
      {
        gameId: "ff-west-11",
        winnerId: "texas",
        confidence: 0.61,
        rationale: "Texas projects as the stronger team after combining ratings, form, and roster context."
      }
    ],
    configId: "2026-bracket"
  });
}
