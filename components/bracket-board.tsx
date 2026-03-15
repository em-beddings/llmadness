"use client";

import { useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { SubmissionView } from "@/lib/repository";

const REGIONAL_ROUNDS = [
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite 8",
] as const;

function getRegions(view: SubmissionView) {
  return Array.from(
    new Set(
      view.gamesByRound
        .flatMap((round) => round.games)
        .map((game) => game.region)
        .filter((region): region is string => Boolean(region)),
    ),
  );
}

function getRegionalRounds(view: SubmissionView, region: string) {
  return REGIONAL_ROUNDS.filter((roundName) =>
    view.gamesByRound.some(
      (round) =>
        round.round === roundName &&
        round.games.some((game) => game.region === region),
    ),
  );
}

function getGamesForRound(
  view: SubmissionView,
  roundName: string,
  region?: string,
) {
  const round = view.gamesByRound.find((entry) => entry.round === roundName);
  if (!round) {
    return [];
  }

  return region
    ? round.games.filter((game) => game.region === region)
    : round.games;
}

function rowStart(roundIndex: number, gameIndex: number) {
  return 2 ** roundIndex + gameIndex * 2 ** (roundIndex + 1);
}

function rowCount(firstRoundGames: number) {
  return Math.max(firstRoundGames * 2 - 1, 1);
}

function GameNode({
  game,
  align,
  onSelect,
}: {
  game: SubmissionView["gamesByRound"][number]["games"][number];
  align: "left" | "right" | "center";
  onSelect: (gameId: string) => void;
}) {
  return (
    <button
      className={`bracket-node bracket-node-${align}`}
      onClick={() => onSelect(game.id)}
      type="button"
    >
      <div
        className={`bracket-team ${game.winner === game.slotA ? "bracket-team-winner" : ""}`}
      >
        <span>{game.slotA}</span>
        {game.winner === game.slotA && game.confidence !== null ? (
          <span className="bracket-team-confidence">
            {Math.round(game.confidence * 100)}%
          </span>
        ) : null}
      </div>
      <div
        className={`bracket-team ${game.winner === game.slotB ? "bracket-team-winner" : ""}`}
      >
        <span>{game.slotB}</span>
        {game.winner === game.slotB && game.confidence !== null ? (
          <span className="bracket-team-confidence">
            {Math.round(game.confidence * 100)}%
          </span>
        ) : null}
      </div>
    </button>
  );
}

function RegionBracket({
  view,
  region,
  side,
  onSelect,
}: {
  view: SubmissionView;
  region: string;
  side: "left" | "right";
  onSelect: (gameId: string) => void;
}) {
  const rounds = getRegionalRounds(view, region);
  const displayRounds = side === "left" ? rounds : [...rounds].reverse();
  const firstRoundGames = getGamesForRound(
    view,
    rounds[0] ?? "Round of 64",
    region,
  ).length;
  const rows = rowCount(firstRoundGames);

  return (
    <section className="region-panel">
      <div className="region-header">
        <h3>{region}</h3>
      </div>
      <div
        className={`region-grid region-grid-${side}`}
        style={
          {
            "--round-count": String(displayRounds.length),
            "--row-count": String(rows),
          } as CSSProperties
        }
      >
        {displayRounds.map((roundName, visibleRoundIndex) => {
          const sourceRoundIndex =
            side === "left"
              ? visibleRoundIndex
              : rounds.length - visibleRoundIndex - 1;
          const games = getGamesForRound(view, roundName, region);

          return (
            <div className="region-round" key={`${region}-${roundName}`}>
              <div className="region-round-grid">
                {games.map((game, gameIndex) => (
                  <div
                    className="region-round-slot"
                    key={game.id}
                    style={{
                      gridRow: `${rowStart(sourceRoundIndex, gameIndex)} / span 1`,
                    }}
                  >
                    <GameNode game={game} align={side} onSelect={onSelect} />
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

function FinalsBracket({
  view,
  onSelect,
}: {
  view: SubmissionView;
  onSelect: (gameId: string) => void;
}) {
  const semifinals = getGamesForRound(view, "Final Four");
  const championship = getGamesForRound(view, "Championship")[0];

  if (semifinals.length === 0 && !championship) {
    return null;
  }

  return (
    <section className="finals-panel">
      <div className="finals-stage-grid">
        <div className="final-four-section">
          <div className="championship-label">Final Four</div>
          <div className="final-four-grid">
            {semifinals.map((game) => (
              <GameNode
                game={game}
                align="center"
                key={game.id}
                onSelect={onSelect}
              />
            ))}
          </div>
        </div>
        {championship ? (
          <div className="championship-wrap">
            <div className="championship-label">Championship</div>
            <GameNode game={championship} align="center" onSelect={onSelect} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

export function BracketBoard({ view }: { view: SubmissionView }) {
  const regions = getRegions(view);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  const selectedGame = useMemo(
    () =>
      view.gamesByRound
        .flatMap((round) => round.games)
        .find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId, view.gamesByRound],
  );

  const selectedReasoning = useMemo(
    () =>
      view.submission.reasoning.find(
        (step) => step.id === `reason-${selectedGameId}`,
      ) ?? null,
    [selectedGameId, view.submission.reasoning],
  );

  return (
    <>
      <section className="panel bracket-shell">
        <div className="section-header">
          <p>
            Click any game for rationale, confidence, and the run transcript.
          </p>
        </div>
        <div className="tournament-bracket">
          <FinalsBracket onSelect={setSelectedGameId} view={view} />
          <div className="regions-overview">
            {regions.map((region, index) => (
              <RegionBracket
                key={region}
                onSelect={setSelectedGameId}
                region={region}
                side={index < 2 ? "left" : "right"}
                view={view}
              />
            ))}
          </div>
        </div>
      </section>

      {selectedGame ? (
        <div
          className="modal-overlay"
          onClick={() => setSelectedGameId(null)}
          role="presentation"
        >
          <div
            aria-modal="true"
            className="game-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
          >
            <div className="game-modal-header">
              <div>
                <p className="eyebrow">Game detail</p>
                <h2>{selectedGame.label}</h2>
                <p>
                  {selectedGame.slotA} vs {selectedGame.slotB}
                </p>
              </div>
              <button
                className="modal-close"
                onClick={() => setSelectedGameId(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="modal-meta-grid">
              <div className="modal-stat">
                <span>Winner</span>
                <strong>{selectedGame.winner ?? "Pending"}</strong>
              </div>
              <div className="modal-stat">
                <span>Confidence</span>
                <strong>
                  {selectedGame.confidence !== null
                    ? `${Math.round(selectedGame.confidence * 100)}%`
                    : "N/A"}
                </strong>
              </div>
              <div className="modal-stat">
                <span>Round</span>
                <strong>{selectedGame.round}</strong>
              </div>
            </div>

            <section className="modal-section">
              <h3>Rationale</h3>
              <p>
                {selectedGame.rationale ??
                  "No rationale recorded for this game."}
              </p>
            </section>

            {selectedReasoning ? (
              <section className="modal-section">
                <h3>Reasoning details</h3>
                <p>{selectedReasoning.summary}</p>
                <ul>
                  {selectedReasoning.evidence.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>
            ) : null}

            <section className="modal-section">
              <h3>Tool calls</h3>
              {view.submission.toolCalls.length === 0 ? (
                <p>No tool calls were recorded for this run.</p>
              ) : (
                <div className="modal-tool-list">
                  {view.submission.toolCalls.map((call) => (
                    <article className="trace-card" key={call.id}>
                      <div className="leader-topline">
                        <strong>{call.toolName}</strong>
                        <span>{call.summary}</span>
                      </div>
                      <pre className="code-block">
                        {JSON.stringify(call.arguments, null, 2)}
                      </pre>
                      <pre className="code-block">
                        {JSON.stringify(call.result, null, 2)}
                      </pre>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      ) : null}
    </>
  );
}
