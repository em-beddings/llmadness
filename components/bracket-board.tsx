import type { CSSProperties } from "react";
import { SubmissionView } from "@/lib/repository";

const REGIONAL_ROUNDS = ["Round of 64", "Round of 32", "Sweet 16", "Elite 8"] as const;

function getRegions(view: SubmissionView) {
  return Array.from(
    new Set(
      view.gamesByRound
        .flatMap((round) => round.games)
        .map((game) => game.region)
        .filter((region): region is string => Boolean(region))
    )
  );
}

function getRegionalRounds(view: SubmissionView, region: string) {
  return REGIONAL_ROUNDS.filter((roundName) =>
    view.gamesByRound.some((round) => round.round === roundName && round.games.some((game) => game.region === region))
  );
}

function getGamesForRound(view: SubmissionView, roundName: string, region?: string) {
  const round = view.gamesByRound.find((entry) => entry.round === roundName);
  if (!round) {
    return [];
  }

  return region ? round.games.filter((game) => game.region === region) : round.games;
}

function rowStart(roundIndex: number, gameIndex: number) {
  return 2 ** roundIndex + gameIndex * 2 ** (roundIndex + 1);
}

function rowCount(firstRoundGames: number) {
  return Math.max(firstRoundGames * 2 - 1, 1);
}

function GameNode({
  game,
  align
}: {
  game: SubmissionView["gamesByRound"][number]["games"][number];
  align: "left" | "right" | "center";
}) {
  return (
    <article className={`bracket-node bracket-node-${align}`}>
      <div className="bracket-node-meta">
        <span>{game.label}</span>
        {game.confidence !== null ? <span>{Math.round(game.confidence * 100)}%</span> : null}
      </div>
      <div className={`bracket-team ${game.winner === game.slotA ? "bracket-team-winner" : ""}`}>{game.slotA}</div>
      <div className={`bracket-team ${game.winner === game.slotB ? "bracket-team-winner" : ""}`}>{game.slotB}</div>
      {game.winner ? <div className="bracket-pick">Pick: {game.winner}</div> : null}
    </article>
  );
}

function RegionBracket({
  view,
  region,
  side
}: {
  view: SubmissionView;
  region: string;
  side: "left" | "right";
}) {
  const rounds = getRegionalRounds(view, region);
  const displayRounds = side === "left" ? rounds : [...rounds].reverse();
  const firstRoundGames = getGamesForRound(view, rounds[0] ?? "Round of 64", region).length;
  const rows = rowCount(firstRoundGames);

  return (
    <section className="region-panel">
      <div className="region-header">
        <h3>{region}</h3>
        <span>{firstRoundGames * 2} teams</span>
      </div>
      <div
        className={`region-grid region-grid-${side}`}
        style={
          {
            "--round-count": String(displayRounds.length),
            "--row-count": String(rows)
          } as CSSProperties
        }
      >
        {displayRounds.map((roundName, visibleRoundIndex) => {
          const sourceRoundIndex = side === "left" ? visibleRoundIndex : rounds.length - visibleRoundIndex - 1;
          const games = getGamesForRound(view, roundName, region);

          return (
            <div className="region-round" key={`${region}-${roundName}`}>
              <div className="region-round-label">{roundName}</div>
              <div className="region-round-grid">
                {games.map((game, gameIndex) => (
                  <div
                    className="region-round-slot"
                    key={game.id}
                    style={{ gridRow: `${rowStart(sourceRoundIndex, gameIndex)} / span 1` }}
                  >
                    <GameNode game={game} align={side} />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function FinalsBracket({ view }: { view: SubmissionView }) {
  const semifinals = getGamesForRound(view, "Final Four");
  const championship = getGamesForRound(view, "Championship")[0];

  if (semifinals.length === 0 && !championship) {
    return null;
  }

  return (
    <section className="finals-panel">
      <div className="region-header">
        <h3>Finals</h3>
        <span>National stage</span>
      </div>
      <div className="finals-stack">
        {semifinals.map((game) => (
          <GameNode game={game} align="center" key={game.id} />
        ))}
        {championship ? (
          <div className="championship-wrap">
            <div className="championship-label">Championship</div>
            <GameNode game={championship} align="center" />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function BracketBoard({ view }: { view: SubmissionView }) {
  const regions = getRegions(view);
  const midpoint = Math.ceil(regions.length / 2);
  const leftRegions = regions.slice(0, midpoint);
  const rightRegions = regions.slice(midpoint);

  return (
    <section className="panel bracket-shell">
      <div className="section-header">
        <h2>Bracket</h2>
        <p>Placed by region and round, with later games centered off earlier winners.</p>
      </div>
      <div className="tournament-bracket">
        <div className="bracket-side">
          {leftRegions.map((region) => (
            <RegionBracket key={region} region={region} side="left" view={view} />
          ))}
        </div>
        <FinalsBracket view={view} />
        <div className="bracket-side">
          {rightRegions.map((region) => (
            <RegionBracket key={region} region={region} side="right" view={view} />
          ))}
        </div>
      </div>
    </section>
  );
}
