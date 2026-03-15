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
  GameDefinition,
  ModelDefinition,
  Team,
  TournamentRound,
} from "@/lib/types";

const ROOT = process.cwd();
const CONFIG_PATH = "data/configs/demo-bracket.json";
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

const REGION_TEAMS: Record<
  (typeof REGIONS)[number],
  Array<{ name: string; shortName: string; conference: string }>
> = {
  East: [
    { name: "Duke", shortName: "DUKE", conference: "ACC" },
    { name: "Mississippi State", shortName: "MSST", conference: "SEC" },
    { name: "Kentucky", shortName: "UK", conference: "SEC" },
    { name: "Maryland", shortName: "MD", conference: "Big Ten" },
    { name: "Oregon", shortName: "ORE", conference: "Big Ten" },
    { name: "BYU", shortName: "BYU", conference: "Big 12" },
    { name: "Clemson", shortName: "CLEM", conference: "ACC" },
    { name: "Florida Atlantic", shortName: "FAU", conference: "AAC" },
    { name: "Colorado State", shortName: "CSU", conference: "MWC" },
    { name: "New Mexico", shortName: "UNM", conference: "MWC" },
    { name: "VCU", shortName: "VCU", conference: "A10" },
    { name: "Liberty", shortName: "LIB", conference: "CUSA" },
    { name: "Yale", shortName: "YALE", conference: "Ivy" },
    { name: "Akron", shortName: "AKR", conference: "MAC" },
    { name: "Vermont", shortName: "UVM", conference: "America East" },
    { name: "Longwood", shortName: "LONG", conference: "Big South" },
  ],
  West: [
    { name: "Houston", shortName: "HOU", conference: "Big 12" },
    { name: "Wisconsin", shortName: "WIS", conference: "Big Ten" },
    { name: "Illinois", shortName: "ILL", conference: "Big Ten" },
    { name: "Saint Mary's", shortName: "SMC", conference: "WCC" },
    { name: "San Diego State", shortName: "SDSU", conference: "MWC" },
    { name: "Texas Tech", shortName: "TTU", conference: "Big 12" },
    { name: "Dayton", shortName: "DAY", conference: "A10" },
    { name: "Nebraska", shortName: "NEB", conference: "Big Ten" },
    { name: "Northwestern", shortName: "NU", conference: "Big Ten" },
    { name: "Utah State", shortName: "USU", conference: "MWC" },
    { name: "Drake", shortName: "DRA", conference: "MVC" },
    { name: "Grand Canyon", shortName: "GCU", conference: "WAC" },
    { name: "Samford", shortName: "SAM", conference: "SoCon" },
    { name: "Colgate", shortName: "COL", conference: "Patriot" },
    { name: "Eastern Washington", shortName: "EWU", conference: "Big Sky" },
    { name: "Howard", shortName: "HOW", conference: "MEAC" },
  ],
  South: [
    { name: "North Carolina", shortName: "UNC", conference: "ACC" },
    { name: "Texas", shortName: "TEX", conference: "SEC" },
    { name: "Baylor", shortName: "BAY", conference: "Big 12" },
    { name: "Auburn", shortName: "AUB", conference: "SEC" },
    { name: "Gonzaga", shortName: "ZAGS", conference: "WCC" },
    { name: "Florida", shortName: "UF", conference: "SEC" },
    { name: "Washington State", shortName: "WSU", conference: "WCC" },
    { name: "TCU", shortName: "TCU", conference: "Big 12" },
    { name: "Boise State", shortName: "BSU", conference: "MWC" },
    { name: "Virginia", shortName: "UVA", conference: "ACC" },
    { name: "Indiana State", shortName: "INST", conference: "MVC" },
    { name: "McNeese", shortName: "MCN", conference: "Southland" },
    { name: "Charleston", shortName: "COC", conference: "CAA" },
    { name: "South Dakota State", shortName: "SDSU2", conference: "Summit" },
    { name: "UC Irvine", shortName: "UCI", conference: "Big West" },
    { name: "Wagner", shortName: "WAG", conference: "NEC" },
  ],
  Midwest: [
    { name: "Purdue", shortName: "PUR", conference: "Big Ten" },
    { name: "Michigan State", shortName: "MSU", conference: "Big Ten" },
    { name: "Creighton", shortName: "CREI", conference: "Big East" },
    { name: "Alabama", shortName: "BAMA", conference: "SEC" },
    { name: "Marquette", shortName: "MARQ", conference: "Big East" },
    { name: "Iowa State", shortName: "ISU", conference: "Big 12" },
    { name: "Texas A&M", shortName: "TAMU", conference: "SEC" },
    { name: "Florida State", shortName: "FSU", conference: "ACC" },
    { name: "Kansas State", shortName: "KSU", conference: "Big 12" },
    { name: "Michigan", shortName: "MICH", conference: "Big Ten" },
    { name: "Princeton", shortName: "PRIN", conference: "Ivy" },
    { name: "James Madison", shortName: "JMU", conference: "Sun Belt" },
    { name: "College of Charleston", shortName: "COFC", conference: "CAA" },
    { name: "Oakland", shortName: "OAK", conference: "Horizon" },
    { name: "Morehead State", shortName: "MORE", conference: "OVC" },
    { name: "Stetson", shortName: "STET", conference: "ASUN" },
  ],
};

function teamId(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function metricForSeed(seed: number, regionIndex: number) {
  return 40 - seed * 1.7 + regionIndex * 0.6;
}

function buildTeams(): Team[] {
  return REGIONS.flatMap((region, regionIndex) =>
    REGION_TEAMS[region].map((entry, teamIndex) => {
      const seed = teamIndex + 1;
      return {
        id: teamId(entry.name),
        name: entry.name,
        shortName: entry.shortName,
        seed,
        region,
        conference: entry.conference,
        metrics: {
          net: Number(metricForSeed(seed, regionIndex).toFixed(1)),
          kenpom: Number((metricForSeed(seed, regionIndex) - 1.8).toFixed(1)),
        },
      };
    }),
  );
}

function regionTeam(region: (typeof REGIONS)[number], seed: number) {
  const entry = REGION_TEAMS[region][seed - 1];
  return teamId(entry.name);
}

function buildRegionGames(
  region: (typeof REGIONS)[number],
  regionIndex: number,
) {
  const games: GameDefinition[] = [];

  ROUND_OF_64_PAIRINGS.forEach(([seedA, seedB], pairIndex) => {
    games.push({
      id: `r64-${region.toLowerCase()}-${pairIndex + 1}`,
      round: "Round of 64",
      region,
      label: `${region} ${seedA}/${seedB}`,
      slotA: { kind: "team", teamId: regionTeam(region, seedA) },
      slotB: { kind: "team", teamId: regionTeam(region, seedB) },
    });
  });

  for (let i = 0; i < 4; i += 1) {
    games.push({
      id: `r32-${region.toLowerCase()}-${i + 1}`,
      round: "Round of 32",
      region,
      label: `${region} Round of 32 ${i + 1}`,
      slotA: {
        kind: "winner",
        gameId: `r64-${region.toLowerCase()}-${i * 2 + 1}`,
      },
      slotB: {
        kind: "winner",
        gameId: `r64-${region.toLowerCase()}-${i * 2 + 2}`,
      },
    });
  }

  for (let i = 0; i < 2; i += 1) {
    games.push({
      id: `s16-${region.toLowerCase()}-${i + 1}`,
      round: "Sweet 16",
      region,
      label: `${region} Sweet 16 ${i + 1}`,
      slotA: {
        kind: "winner",
        gameId: `r32-${region.toLowerCase()}-${i * 2 + 1}`,
      },
      slotB: {
        kind: "winner",
        gameId: `r32-${region.toLowerCase()}-${i * 2 + 2}`,
      },
    });
  }

  games.push({
    id: `e8-${region.toLowerCase()}-1`,
    round: "Elite 8",
    region,
    label: `${region} Regional Final`,
    slotA: { kind: "winner", gameId: `s16-${region.toLowerCase()}-1` },
    slotB: { kind: "winner", gameId: `s16-${region.toLowerCase()}-2` },
  });

  void regionIndex;
  return games;
}

function buildConfig(): BracketConfig {
  const teams = buildTeams();
  const games = REGIONS.flatMap((region, regionIndex) =>
    buildRegionGames(region, regionIndex),
  );

  games.push(
    {
      id: "f4-1",
      round: "Final Four",
      label: "National semifinal 1",
      slotA: { kind: "winner", gameId: "e8-east-1" },
      slotB: { kind: "winner", gameId: "e8-west-1" },
    },
    {
      id: "f4-2",
      round: "Final Four",
      label: "National semifinal 2",
      slotA: { kind: "winner", gameId: "e8-south-1" },
      slotB: { kind: "winner", gameId: "e8-midwest-1" },
    },
    {
      id: "title",
      round: "Championship",
      label: "National championship",
      slotA: { kind: "winner", gameId: "f4-1" },
      slotB: { kind: "winner", gameId: "f4-2" },
    },
  );

  return {
    id: "demo-2026-bracket",
    title: "LLMadness",
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

      const scoreA = seedStrength(teamA.seed) + (teamA.metrics?.net ?? 0) / 10;
      const scoreB = seedStrength(teamB.seed) + (teamB.metrics?.net ?? 0) / 10;
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
  await writeJsonFile(
    path.join(ROOT, "data", "runs", RUN_ID, "manifest.json"),
    manifest,
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
