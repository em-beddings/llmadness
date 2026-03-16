import path from "node:path";
import { readJsonFile } from "@/lib/fs";
import { AgentToolCall, AgentToolDefinition, BracketConfig, Team } from "@/lib/types";
import { AgentTool, PredictionInput, ToolRuntime, ToolRuntimeOptions } from "@/agents/interfaces";

function makeId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function summarizeText(input: string, maxChars = 3000) {
  return input.replace(/\s+/g, " ").trim().slice(0, maxChars);
}

function stripHtml(html: string) {
  return summarizeText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
  );
}

function decodeHtmlEntities(input: string) {
  return input
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function normalizeRatingsPayload(payload: unknown) {
  if (Array.isArray(payload)) {
    return payload;
  }

  if (payload && typeof payload === "object") {
    for (const key of ["data", "teams", "rows"]) {
      const value = (payload as Record<string, unknown>)[key];
      if (Array.isArray(value)) {
        return value;
      }
    }
  }

  throw new Error("Ratings payload must be an array or an object with a data, teams, or rows array.");
}

function normalizeTeamLookupName(name: string) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function matchTeams(teams: Team[], ids?: string[], names?: string[]) {
  const wantedIds = new Set(ids ?? []);
  const wantedNames = new Set((names ?? []).map((name) => name.toLowerCase()));

  if (wantedIds.size === 0 && wantedNames.size === 0) {
    return teams;
  }

  return teams.filter(
    (team) => wantedIds.has(team.id) || wantedNames.has(team.name.toLowerCase()) || wantedNames.has(team.shortName.toLowerCase())
  );
}

export class AgentToolRuntime implements ToolRuntime {
  private readonly transcriptEntries: AgentToolCall[] = [];

  constructor(
    private readonly tools: AgentTool[],
    private readonly input: PredictionInput,
    private readonly options: ToolRuntimeOptions = {}
  ) {}

  list() {
    return this.tools.map((tool) => tool.definition);
  }

  async invoke(name: string, args: unknown) {
    const tool = this.tools.find((entry) => entry.definition.name === name);
    if (!tool) {
      throw new Error(`Unknown tool "${name}"`);
    }

    const startedAt = new Date().toISOString();
    let summary: string;
    let result: unknown;
    try {
      const execution = await tool.execute(args, this.input);
      summary = execution.summary;
      result = execution.result;
    } catch (error) {
      summary = error instanceof Error ? error.message : "Tool execution failed.";
      result = {
        error: summary
      };
    }
    const completedAt = new Date().toISOString();

    const call = {
      id: makeId("tool"),
      toolName: name,
      arguments: args,
      startedAt,
      completedAt,
      summary,
      result
    } satisfies AgentToolCall;

    this.transcriptEntries.push(call);
    await this.options.onToolCall?.(call);

    return result;
  }

  transcript() {
    return this.transcriptEntries;
  }

  updateContext(context: Pick<PredictionInput, "priorPicks" | "currentGame">) {
    this.input.priorPicks = context.priorPicks;
    this.input.currentGame = context.currentGame;
  }
}

export class ListTeamsTool implements AgentTool {
  definition: AgentToolDefinition = {
    name: "list_teams",
    description: "List teams in the bracket with IDs, seeds, regions, and conferences.",
    inputSchema: {
      type: "object",
      properties: {
        region: { type: "string", description: "Optional region filter." }
      }
    }
  };

  async execute(args: unknown, input: PredictionInput) {
    const region = typeof args === "object" && args && "region" in args ? String((args as { region?: unknown }).region ?? "") : "";
    const teams = input.config.teams.filter((team) => !region || team.region === region);
    return {
      summary: `Returned ${teams.length} teams${region ? ` for region ${region}` : ""}.`,
      result: teams
    };
  }
}

export class GetGamesTool implements AgentTool {
  definition: AgentToolDefinition = {
    name: "get_games",
    description: "Get bracket game definitions, round labels, regions, and slots for selected game IDs or all games.",
    inputSchema: {
      type: "object",
      properties: {
        gameIds: {
          type: "array",
          items: { type: "string" },
          description: "Optional subset of game IDs."
        }
      }
    }
  };

  async execute(args: unknown, input: PredictionInput) {
    const gameIds =
      typeof args === "object" && args && "gameIds" in args && Array.isArray((args as { gameIds?: unknown }).gameIds)
        ? ((args as { gameIds: string[] }).gameIds ?? [])
        : [];
    const selected = gameIds.length === 0 ? input.config.games : input.config.games.filter((game) => gameIds.includes(game.id));
    return {
      summary: `Returned ${selected.length} games.`,
      result: selected
    };
  }
}

export class SearchWebTool implements AgentTool {
  definition: AgentToolDefinition = {
    name: "search_web",
    description: "Search the web for recent team, matchup, injury, or bracket analysis.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        domains: { type: "array", items: { type: "string" } },
        maxResults: { type: "number" }
      },
      required: ["query"]
    }
  };

  async execute(args: unknown, _input: PredictionInput) {
    const parsed = (args ?? {}) as {
      query?: string;
      domains?: string[];
      maxResults?: number;
    };
    const query = parsed.query?.trim();
    if (!query) {
      throw new Error("search_web requires a non-empty query.");
    }

    const domainFilter =
      parsed.domains && parsed.domains.length > 0
        ? ` ${parsed.domains.map((domain) => `site:${domain}`).join(" OR ")}`
        : "";
    const url = new URL("https://html.duckduckgo.com/html/");
    url.searchParams.set("q", `${query}${domainFilter}`);

    const response = await fetch(url, {
      headers: {
        "User-Agent": "LLMadness/0.1"
      }
    });
    if (!response.ok) {
      throw new Error(`search_web failed: ${response.status} ${await response.text()}`);
    }

    const html = await response.text();
    const matches = [...html.matchAll(/<a[^>]*class="[^"]*result__a[^"]*"[^>]*href="([^"]+)"[^>]*>(.*?)<\/a>[\s\S]*?(?:<a[^>]*class="[^"]*result__snippet[^"]*"[^>]*>|<div[^>]*class="[^"]*result__snippet[^"]*"[^>]*>)([\s\S]*?)(?:<\/a>|<\/div>)/g)];
    const maxResults = Math.min(parsed.maxResults ?? 5, 10);

    const results = matches.slice(0, maxResults).map((match) => ({
      title: decodeHtmlEntities(stripHtml(match[2] ?? "")),
      url: decodeHtmlEntities(match[1] ?? ""),
      snippet: decodeHtmlEntities(stripHtml(match[3] ?? ""))
    }));

    return {
      summary: `Returned ${results.length} search results for "${query}".`,
      result: results
    };
  }
}

export class FetchWebpageTool implements AgentTool {
  definition: AgentToolDefinition = {
    name: "fetch_webpage",
    description: "Fetch a webpage and extract readable text. Useful after web search identifies a relevant article or ratings page.",
    inputSchema: {
      type: "object",
      properties: {
        url: { type: "string" },
        maxChars: { type: "number" }
      },
      required: ["url"]
    }
  };

  async execute(args: unknown, _input: PredictionInput) {
    const parsed = (args ?? {}) as { url?: string; maxChars?: number };
    if (!parsed.url) {
      throw new Error("fetch_webpage requires a url.");
    }

    const response = await fetch(parsed.url, {
      headers: {
        "User-Agent": "LLMadness/0.1"
      }
    });

    if (!response.ok) {
      throw new Error(`fetch_webpage failed: ${response.status} ${await response.text()}`);
    }

    const html = await response.text();
    const text = stripHtml(html).slice(0, Math.min(parsed.maxChars ?? 4000, 12000));

    return {
      summary: `Fetched ${parsed.url} and extracted ${text.length} characters of text.`,
      result: {
        url: parsed.url,
        text
      }
    };
  }
}

export class SearchEspnNewsTool implements AgentTool {
  definition: AgentToolDefinition = {
    name: "search_espn_news",
    description: "Search ESPN coverage for a team, matchup, player, or injury storyline.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string" },
        maxResults: { type: "number" }
      },
      required: ["query"]
    }
  };

  async execute(args: unknown, input: PredictionInput) {
    void input;
    const parsed = (args ?? {}) as { query?: string; maxResults?: number };
    const delegate = new SearchWebTool();
    return delegate.execute(
      {
        query: parsed.query,
        maxResults: parsed.maxResults ?? 5,
        domains: ["espn.com"]
      },
      input
    );
  }
}

export class LookupRatingsTool implements AgentTool {
  definition: AgentToolDefinition = {
    name: "lookup_cbb_ratings",
    description:
      "Look up combined Bart Torvik and KenPom ratings from local stats files.",
    inputSchema: {
      type: "object",
      properties: {
        teamIds: { type: "array", items: { type: "string" } },
        teamNames: { type: "array", items: { type: "string" } }
      }
    }
  };

  private async loadRatingsPayload() {
    const [torvikPayload, kenpomPayload] = await Promise.all([
      readJsonFile<unknown>(path.join(process.cwd(), "data/stats/torvik.json")),
      readJsonFile<unknown>(path.join(process.cwd(), "data/stats/kenpom.json"))
    ]);

    return {
      torvik: normalizeRatingsPayload(torvikPayload) as Array<Record<string, unknown>>,
      kenpom: normalizeRatingsPayload(kenpomPayload) as Array<Record<string, unknown>>
    };
  }

  async execute(args: unknown, input: PredictionInput) {
    const parsed = (args ?? {}) as { teamIds?: string[]; teamNames?: string[] };
    const ratingsRows = await this.loadRatingsPayload();
    const teams = matchTeams(input.config.teams, parsed.teamIds, parsed.teamNames);
    const wantedNames = new Set(
      teams.flatMap((team) => [normalizeTeamLookupName(team.name), normalizeTeamLookupName(team.shortName)])
    );
    const requestedNames = new Set((parsed.teamNames ?? []).map((name) => normalizeTeamLookupName(name)));
    const requestedIds = new Set(parsed.teamIds ?? []);

    const effectiveNames =
      wantedNames.size > 0 || requestedNames.size > 0
        ? new Set([...wantedNames, ...requestedNames])
        : new Set<string>();

    const collectMatches = (rows: Array<Record<string, unknown>>) => {
      const index = new Map<string, Record<string, unknown>>();
      for (const row of rows) {
        const rowName = normalizeTeamLookupName(String(row.team ?? row.name ?? row.school ?? ""));
        if (!rowName) {
          continue;
        }

        if (effectiveNames.size === 0 || effectiveNames.has(rowName)) {
          index.set(rowName, row);
        }
      }
      return index;
    };

    const torvikIndex = collectMatches(ratingsRows.torvik);
    const kenpomIndex = collectMatches(ratingsRows.kenpom);

    const teamResults =
      teams.length > 0
        ? teams.map((team) => {
            const keys = [normalizeTeamLookupName(team.name), normalizeTeamLookupName(team.shortName)];
            const matchedKey = keys.find((key) => torvikIndex.has(key) || kenpomIndex.has(key));
            return {
              teamId: team.id,
              teamName: team.name,
              torvik: matchedKey ? torvikIndex.get(matchedKey) ?? null : null,
              kenpom: matchedKey ? kenpomIndex.get(matchedKey) ?? null : null
            };
          })
        : [...new Set([...torvikIndex.keys(), ...kenpomIndex.keys()])]
            .map((key) => ({
              teamId: [...requestedIds][0] ?? null,
              teamName: key,
              torvik: torvikIndex.get(key) ?? null,
              kenpom: kenpomIndex.get(key) ?? null
            }));

    return {
      summary: `Returned combined Torvik/KenPom ratings for ${teamResults.length} team${teamResults.length === 1 ? "" : "s"}.`,
      result: teamResults
    };
  }
}

export function createDefaultTools(config: BracketConfig, options: ToolRuntimeOptions = {}) {
  const input = {
    config,
    priorPicks: [],
    currentGame: undefined,
    tools: {} as ToolRuntime
  };

  const runtime = new AgentToolRuntime(
    [
      new ListTeamsTool(),
      new GetGamesTool(),
      new LookupRatingsTool(),
      new SearchWebTool(),
      new SearchEspnNewsTool(),
      new FetchWebpageTool()
    ],
    input,
    options
  );

  input.tools = runtime;
  return runtime;
}
