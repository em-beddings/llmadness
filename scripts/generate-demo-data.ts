import path from "node:path";
import { mkdir } from "node:fs/promises";
import { CentralBracketAgent } from "@/agents/central-agent";
import { MockModelAdapter } from "@/agents/mock-model";
import { readJsonFile, writeJsonFile } from "@/lib/fs";
import { modelDefinitionSchema } from "@/lib/schema";
import { scoreSubmissions } from "@/lib/scoring";
import {
  ActualResults,
  BracketConfig,
  CompetitorRef,
  GameDefinition,
  ModelDefinition,
  Team,
  TournamentRound,
} from "@/lib/types";

const ROOT = process.cwd();
const CONFIG_PATH = "data/configs/2026-mens-bracket.json";
const RESULTS_PATH = "data/results/demo-actual-results.json";
const MODELS_PATH = "data/models/demo-models.json";
const RUN_ID = "demo-2026";

const REGIONS = ["East", "West", "South", "Midwest"] as const;
const ROUND_OF_64_PAIRINGS: Array<[number, number]> = [
  [1, 16],
  [8, 9],
  [5, 12],
  [4, 13],
  [6, 11],
  [3, 14],
  [7, 10],
  [2, 15],
];

type RegionName = (typeof REGIONS)[number];

interface TeamSeedEntry {
  kind: "team";
  team: {
    name: string;
    shortName: string;
    conference: string;
  };
}

interface PlayInSeedEntry {
  kind: "play-in";
  playInGameId: string;
}

type SeedEntry = TeamSeedEntry | PlayInSeedEntry;

interface PlayInGameEntry {
  id: string;
  region: RegionName;
  seed: number;
  teams: Array<{
    name: string;
    shortName: string;
    conference: string;
  }>;
}

const PLAY_IN_GAMES: PlayInGameEntry[] = [
  {
    id: "ff-west-11",
    region: "West",
    seed: 11,
    teams: [
      { name: "NC State", shortName: "NCSU", conference: "ACC" },
      { name: "Texas", shortName: "TEX", conference: "SEC" },
    ],
  },
  {
    id: "ff-midwest-11",
    region: "Midwest",
    seed: 11,
    teams: [
      { name: "SMU", shortName: "SMU", conference: "ACC" },
      { name: "Miami (OH)", shortName: "M-OH", conference: "MAC" },
    ],
  },
  {
    id: "ff-midwest-16",
    region: "Midwest",
    seed: 16,
    teams: [
      { name: "Howard", shortName: "HOW", conference: "MEAC" },
      { name: "UMBC", shortName: "UMBC", conference: "America East" },
    ],
  },
  {
    id: "ff-south-16",
    region: "South",
    seed: 16,
    teams: [
      { name: "Lehigh", shortName: "LEH", conference: "Patriot" },
      { name: "Prairie View A&M", shortName: "PVAM", conference: "SWAC" },
    ],
  },
];

function winnerRef(gameId: string): CompetitorRef {
  return { kind: "winner", gameId };
}

const REGION_FIELDS: Record<RegionName, Record<number, SeedEntry>> = {
  East: {
    1: { kind: "team", team: { name: "Duke", shortName: "DUKE", conference: "ACC" } },
    2: { kind: "team", team: { name: "UConn", shortName: "UCONN", conference: "Big East" } },
    3: { kind: "team", team: { name: "Michigan State", shortName: "MSU", conference: "Big Ten" } },
    4: { kind: "team", team: { name: "Kansas", shortName: "KU", conference: "Big 12" } },
    5: { kind: "team", team: { name: "St. John's", shortName: "SJU", conference: "Big East" } },
    6: { kind: "team", team: { name: "Louisville", shortName: "LOU", conference: "ACC" } },
    7: { kind: "team", team: { name: "UCLA", shortName: "UCLA", conference: "Big Ten" } },
    8: { kind: "team", team: { name: "Ohio State", shortName: "OSU", conference: "Big Ten" } },
    9: { kind: "team", team: { name: "TCU", shortName: "TCU", conference: "Big 12" } },
    10: { kind: "team", team: { name: "UCF", shortName: "UCF", conference: "Big 12" } },
    11: { kind: "team", team: { name: "South Florida", shortName: "USF", conference: "AAC" } },
    12: { kind: "team", team: { name: "Northern Iowa", shortName: "UNI", conference: "MVC" } },
    13: { kind: "team", team: { name: "California Baptist", shortName: "CBU", conference: "WAC" } },
    14: { kind: "team", team: { name: "North Dakota State", shortName: "NDSU", conference: "Summit" } },
    15: { kind: "team", team: { name: "Furman", shortName: "FUR", conference: "SoCon" } },
    16: { kind: "team", team: { name: "Siena", shortName: "SIE", conference: "MAAC" } },
  },
  West: {
    1: { kind: "team", team: { name: "Arizona", shortName: "ARIZ", conference: "Big 12" } },
    2: { kind: "team", team: { name: "Purdue", shortName: "PUR", conference: "Big Ten" } },
    3: { kind: "team", team: { name: "Gonzaga", shortName: "GONZ", conference: "WCC" } },
    4: { kind: "team", team: { name: "Arkansas", shortName: "ARK", conference: "SEC" } },
    5: { kind: "team", team: { name: "Wisconsin", shortName: "WIS", conference: "Big Ten" } },
    6: { kind: "team", team: { name: "BYU", shortName: "BYU", conference: "Big 12" } },
    7: { kind: "team", team: { name: "Miami (FL)", shortName: "MIA", conference: "ACC" } },
    8: { kind: "team", team: { name: "Villanova", shortName: "NOVA", conference: "Big East" } },
    9: { kind: "team", team: { name: "Utah State", shortName: "USU", conference: "MWC" } },
    10: { kind: "team", team: { name: "Missouri", shortName: "MIZZ", conference: "SEC" } },
    11: { kind: "play-in", playInGameId: "ff-west-11" },
    12: { kind: "team", team: { name: "High Point", shortName: "HPU", conference: "Big South" } },
    13: { kind: "team", team: { name: "Hawai'i", shortName: "HAW", conference: "Big West" } },
    14: { kind: "team", team: { name: "Kennesaw State", shortName: "KENN", conference: "Conference USA" } },
    15: { kind: "team", team: { name: "Queens", shortName: "QUE", conference: "ASUN" } },
    16: { kind: "team", team: { name: "LIU", shortName: "LIU", conference: "NEC" } },
  },
  South: {
    1: { kind: "team", team: { name: "Florida", shortName: "FLA", conference: "SEC" } },
    2: { kind: "team", team: { name: "Houston", shortName: "HOU", conference: "Big 12" } },
    3: { kind: "team", team: { name: "Illinois", shortName: "ILL", conference: "Big Ten" } },
    4: { kind: "team", team: { name: "Nebraska", shortName: "NEB", conference: "Big Ten" } },
    5: { kind: "team", team: { name: "Vanderbilt", shortName: "VANDY", conference: "SEC" } },
    6: { kind: "team", team: { name: "North Carolina", shortName: "UNC", conference: "ACC" } },
    7: { kind: "team", team: { name: "Saint Mary's", shortName: "SMC", conference: "WCC" } },
    8: { kind: "team", team: { name: "Clemson", shortName: "CLEM", conference: "ACC" } },
    9: { kind: "team", team: { name: "Iowa", shortName: "IOWA", conference: "Big Ten" } },
    10: { kind: "team", team: { name: "Texas A&M", shortName: "TAMU", conference: "SEC" } },
    11: { kind: "team", team: { name: "VCU", shortName: "VCU", conference: "A-10" } },
    12: { kind: "team", team: { name: "McNeese", shortName: "MCN", conference: "Southland" } },
    13: { kind: "team", team: { name: "Troy", shortName: "TROY", conference: "Sun Belt" } },
    14: { kind: "team", team: { name: "Penn", shortName: "PENN", conference: "Ivy" } },
    15: { kind: "team", team: { name: "Idaho", shortName: "IDA", conference: "Big Sky" } },
    16: { kind: "play-in", playInGameId: "ff-south-16" },
  },
  Midwest: {
    1: { kind: "team", team: { name: "Michigan", shortName: "MICH", conference: "Big Ten" } },
    2: { kind: "team", team: { name: "Iowa State", shortName: "ISU", conference: "Big 12" } },
    3: { kind: "team", team: { name: "Virginia", shortName: "UVA", conference: "ACC" } },
    4: { kind: "team", team: { name: "Alabama", shortName: "BAMA", conference: "SEC" } },
    5: { kind: "team", team: { name: "Texas Tech", shortName: "TTU", conference: "Big 12" } },
    6: { kind: "team", team: { name: "Tennessee", shortName: "TENN", conference: "SEC" } },
    7: { kind: "team", team: { name: "Kentucky", shortName: "UK", conference: "SEC" } },
    8: { kind: "team", team: { name: "Georgia", shortName: "UGA", conference: "SEC" } },
    9: { kind: "team", team: { name: "Saint Louis", shortName: "SLU", conference: "A-10" } },
    10: { kind: "team", team: { name: "Santa Clara", shortName: "SCU", conference: "WCC" } },
    11: { kind: "play-in", playInGameId: "ff-midwest-11" },
    12: { kind: "team", team: { name: "Akron", shortName: "AKR", conference: "MAC" } },
    13: { kind: "team", team: { name: "Hofstra", shortName: "HOF", conference: "CAA" } },
    14: { kind: "team", team: { name: "Wright State", shortName: "WSU", conference: "Horizon" } },
    15: { kind: "team", team: { name: "Tennessee State", shortName: "TNST", conference: "OVC" } },
    16: { kind: "play-in", playInGameId: "ff-midwest-16" },
  },
};

function teamId(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function buildTeams(): Team[] {
  const teams: Team[] = [];

  for (const region of REGIONS) {
    for (let seed = 1; seed <= 16; seed += 1) {
      const entry = REGION_FIELDS[region][seed];
      if (entry.kind === "team") {
        teams.push({
          id: teamId(entry.team.name),
          name: entry.team.name,
          shortName: entry.team.shortName,
          seed,
          region,
          conference: entry.team.conference,
        });
      }
    }
  }

  for (const playIn of PLAY_IN_GAMES) {
    for (const team of playIn.teams) {
      teams.push({
        id: teamId(team.name),
        name: team.name,
        shortName: team.shortName,
        seed: playIn.seed,
        region: playIn.region,
        conference: team.conference,
      });
    }
  }

  return teams;
}

function buildFirstFourGames(): GameDefinition[] {
  return PLAY_IN_GAMES.map((game) => ({
    id: game.id,
    round: "First Four",
    region: game.region,
    label: `${game.region} 11 play-in`.replace("11", String(game.seed)),
    slotA: { kind: "team", teamId: teamId(game.teams[0].name) },
    slotB: { kind: "team", teamId: teamId(game.teams[1].name) },
  }));
}

function seedRef(region: RegionName, seed: number): CompetitorRef {
  const entry = REGION_FIELDS[region][seed];
  if (entry.kind === "team") {
    return { kind: "team", teamId: teamId(entry.team.name) };
  }

  return { kind: "winner", gameId: entry.playInGameId };
}

function buildRegionGames(region: RegionName): GameDefinition[] {
  const games: GameDefinition[] = [];

  ROUND_OF_64_PAIRINGS.forEach(([seedA, seedB], pairIndex) => {
    games.push({
      id: `r64-${region.toLowerCase()}-${pairIndex + 1}`,
      round: "Round of 64",
      region,
      label: `${region} ${seedA}/${seedB}`,
      slotA: seedRef(region, seedA),
      slotB: seedRef(region, seedB),
    });
  });

  for (let i = 0; i < 4; i += 1) {
    games.push({
      id: `r32-${region.toLowerCase()}-${i + 1}`,
      round: "Round of 32",
      region,
      label: `${region} Round of 32 ${i + 1}`,
      slotA: winnerRef(`r64-${region.toLowerCase()}-${i * 2 + 1}`),
      slotB: winnerRef(`r64-${region.toLowerCase()}-${i * 2 + 2}`),
    });
  }

  for (let i = 0; i < 2; i += 1) {
    games.push({
      id: `s16-${region.toLowerCase()}-${i + 1}`,
      round: "Sweet 16",
      region,
      label: `${region} Sweet 16 ${i + 1}`,
      slotA: winnerRef(`r32-${region.toLowerCase()}-${i * 2 + 1}`),
      slotB: winnerRef(`r32-${region.toLowerCase()}-${i * 2 + 2}`),
    });
  }

  games.push({
    id: `e8-${region.toLowerCase()}-1`,
    round: "Elite 8",
    region,
    label: `${region} Regional Final`,
    slotA: winnerRef(`s16-${region.toLowerCase()}-1`),
    slotB: winnerRef(`s16-${region.toLowerCase()}-2`),
  });

  return games;
}

function buildConfig(): BracketConfig {
  const teams = buildTeams();
  const games = [
    ...buildFirstFourGames(),
    ...REGIONS.flatMap((region) => buildRegionGames(region)),
    {
      id: "f4-1",
      round: "Final Four" as const,
      label: "National semifinal 1",
      slotA: winnerRef("e8-east-1"),
      slotB: winnerRef("e8-south-1"),
    },
    {
      id: "f4-2",
      round: "Final Four" as const,
      label: "National semifinal 2",
      slotA: winnerRef("e8-west-1"),
      slotB: winnerRef("e8-midwest-1"),
    },
    {
      id: "title",
      round: "Championship" as const,
      label: "National championship",
      slotA: winnerRef("f4-1"),
      slotB: winnerRef("f4-2"),
    },
  ];

  return {
    id: "demo-2026-bracket",
    title: "2026 NCAA Men's Tournament",
    year: 2026,
    division: "mens",
    publishedAt: "2026-03-15T22:00:00Z",
    teams,
    games,
  };
}

function seedStrength(seed: number) {
  return 17 - seed;
}

function determineActualResults(config: BracketConfig): ActualResults {
  const teamIndex = new Map(config.teams.map((team) => [team.id, team]));
  const winners = new Map<string, string>();

  const roundOrder: TournamentRound[] = [
    "First Four",
    "Round of 64",
    "Round of 32",
    "Sweet 16",
    "Elite 8",
    "Final Four",
    "Championship",
  ];

  for (const round of roundOrder) {
    for (const game of config.games.filter((entry) => entry.round === round)) {
      const teamA =
        game.slotA.kind === "team"
          ? teamIndex.get(game.slotA.teamId)
          : teamIndex.get(winners.get(game.slotA.gameId) ?? "");
      const teamB =
        game.slotB.kind === "team"
          ? teamIndex.get(game.slotB.teamId)
          : teamIndex.get(winners.get(game.slotB.gameId) ?? "");

      if (!teamA || !teamB) {
        throw new Error(`Unable to resolve actual result for ${game.id}`);
      }

      const scoreA = seedStrength(teamA.seed);
      const scoreB = seedStrength(teamB.seed);
      const winner = scoreA >= scoreB ? teamA : teamB;
      winners.set(game.id, winner.id);
    }
  }

  return {
    configId: config.id,
    results: config.games.map((game) => ({
      gameId: game.id,
      winnerId: winners.get(game.id) ?? "",
    })),
  };
}

async function main() {
  const config = buildConfig();
  const results = determineActualResults(config);

  await writeJsonFile(path.join(ROOT, CONFIG_PATH), config);
  await writeJsonFile(path.join(ROOT, RESULTS_PATH), results);

  const models = modelDefinitionSchema
    .array()
    .parse(await readJsonFile<ModelDefinition[]>(path.join(ROOT, MODELS_PATH)));
  const agent = new CentralBracketAgent({
    mock: new MockModelAdapter(),
  });

  const outDir = path.join(ROOT, "data", "runs", RUN_ID);
  await mkdir(outDir, { recursive: true });

  const submissions = [];
  const manifest = {
    id: RUN_ID,
    title: `${config.title} bracket run`,
    createdAt: new Date().toISOString(),
    configPath: CONFIG_PATH,
    submissions: [] as Array<{ modelId: string; file: string }>,
    leaderboardPath: path.join("data", "runs", RUN_ID, "leaderboard.json"),
    actualResultsPath: path.join("data", "runs", RUN_ID, "actual-results.json"),
  };

  for (const model of models) {
    const submission = await agent.run(RUN_ID, config, model);
    const file = path.join("data", "runs", RUN_ID, `${model.id}.json`);
    await writeJsonFile(path.join(ROOT, file), submission);
    manifest.submissions.push({ modelId: model.id, file });
    submissions.push(submission);
  }

  const leaderboard = scoreSubmissions(RUN_ID, config, submissions, results);

  await writeJsonFile(path.join(ROOT, manifest.actualResultsPath), results);
  await writeJsonFile(path.join(ROOT, manifest.leaderboardPath), leaderboard);
  await writeJsonFile(path.join(ROOT, "data", "runs", RUN_ID, "manifest.json"), manifest);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
