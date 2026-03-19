"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { SubmissionView } from "@/lib/repository";

const REGIONAL_ROUNDS = [
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite 8",
] as const;

const REGION_DISPLAY_ORDER = ["East", "West", "South", "Midwest"] as const;

function normalizeRegionName(region: string) {
  return region.trim().toLowerCase();
}

function getRegions(view: SubmissionView) {
  const discoveredRegions = Array.from(
    new Set(
      view.gamesByRound
        .flatMap((round) => round.games)
        .map((game) => game.region)
        .filter((region): region is string => Boolean(region)),
    ),
  );

  const prioritizedRegions = REGION_DISPLAY_ORDER.flatMap((targetRegion) =>
    discoveredRegions.filter(
      (region) =>
        normalizeRegionName(region) === normalizeRegionName(targetRegion),
    ),
  );

  const remainingRegions = discoveredRegions.filter(
    (region) =>
      !REGION_DISPLAY_ORDER.some(
        (targetRegion) =>
          normalizeRegionName(targetRegion) === normalizeRegionName(region),
      ),
  );

  return [...prioritizedRegions, ...remainingRegions];
}

function getRegionSide(region: string) {
  const normalized = normalizeRegionName(region);
  return normalized === "west" || normalized === "midwest" ? "right" : "left";
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

function formatTraceContent(type: string, content: string) {
  if (type !== "final_json") {
    return content;
  }

  try {
    return JSON.stringify(JSON.parse(content), null, 2);
  } catch {
    return content;
  }
}

function isTraceExpandedByDefault(type: string) {
  return (
    type === "system_prompt" ||
    type === "user_prompt" ||
    type === "assistant_message" ||
    type === "tool_call" ||
    type === "final_json"
  );
}

function GameNode({
  game,
  align,
  hideConnector = false,
  onSelect,
}: {
  game: SubmissionView["gamesByRound"][number]["games"][number];
  align: "left" | "right" | "center";
  hideConnector?: boolean;
  onSelect: (gameId: string) => void;
}) {
  return (
    <button
      className={`bracket-node bracket-node-${align}${hideConnector ? " bracket-node-no-connector" : ""}`}
      onClick={() => onSelect(game.id)}
      type="button"
    >
      <div
        className={`bracket-team ${game.winner === game.slotA ? `bracket-team-winner ${game.winnerStatus ? `bracket-team-${game.winnerStatus}` : ""}` : ""}`}
      >
        <span>{game.slotA}</span>
        {game.winner === game.slotA && game.confidence !== null ? (
          <span className="bracket-team-confidence">
            {Math.round(game.confidence * 100)}%
          </span>
        ) : null}
      </div>
      <div
        className={`bracket-team ${game.winner === game.slotB ? `bracket-team-winner ${game.winnerStatus ? `bracket-team-${game.winnerStatus}` : ""}` : ""}`}
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
      <div
        className={`region-header ${side === "right" ? "region-header-right" : ""}`}
      >
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
                    <GameNode
                      game={game}
                      align={side}
                      hideConnector={roundName === "Elite 8"}
                      onSelect={onSelect}
                    />
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
          <div className="region-header">
            <h3>Final Four</h3>
          </div>
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
            <div className="region-header">
              <h3>Championship</h3>
            </div>
            <GameNode game={championship} align="center" onSelect={onSelect} />
          </div>
        ) : null}
      </div>
    </section>
  );
}

function FirstFourBracket({
  view,
  onSelect,
}: {
  view: SubmissionView;
  onSelect: (gameId: string) => void;
}) {
  const games = getGamesForRound(view, "First Four").filter(
    (game) => game.winner !== null,
  );
  if (games.length === 0) {
    if (view.submission.model.id !== "mimo-v2-pro") {
      return null;
    }

    return (
      <section className="first-four-panel">
        <div className="region-header">
          <h3>First Four</h3>
        </div>
        <p className="first-four-note">
          MiMo-V2-Pro was released after the First Four games were played.
        </p>
      </section>
    );
  }

  return (
    <section className="first-four-panel">
      <div className="region-header">
        <h3>First Four</h3>
      </div>
      <div className="first-four-grid">
        {games.map((game) => (
          <GameNode
            key={game.id}
            game={game}
            align="center"
            onSelect={onSelect}
          />
        ))}
      </div>
    </section>
  );
}

export function BracketBoard({ view }: { view: SubmissionView }) {
  const regions = getRegions(view);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [collapsedTraceEventIds, setCollapsedTraceEventIds] = useState<
    string[]
  >([]);
  const [expandedTraceEventIds, setExpandedTraceEventIds] = useState<string[]>(
    [],
  );

  const selectedGame = useMemo(
    () =>
      view.gamesByRound
        .flatMap((round) => round.games)
        .find((game) => game.id === selectedGameId) ?? null,
    [selectedGameId, view.gamesByRound],
  );

  const selectedReasoning = useMemo(
    () => selectedGame?.reasoningStep ?? null,
    [selectedGame],
  );

  useEffect(() => {
    setCollapsedTraceEventIds([]);
    setExpandedTraceEventIds([]);
  }, [selectedGameId]);

  const toggleTraceEvent = (eventId: string, defaultExpanded: boolean) => {
    if (defaultExpanded) {
      setCollapsedTraceEventIds((current) =>
        current.includes(eventId)
          ? current.filter((id) => id !== eventId)
          : [...current, eventId],
      );
      return;
    }

    setExpandedTraceEventIds((current) =>
      current.includes(eventId)
        ? current.filter((id) => id !== eventId)
        : [...current, eventId],
    );
  };

  return (
    <>
      <section className="panel bracket-shell">
        <div className="section-header bracket-section-header">
          <p>Click any game for rationale, confidence, and the model trace</p>
        </div>
        <div className="tournament-bracket">
          <FinalsBracket onSelect={setSelectedGameId} view={view} />
          <div className="regions-overview">
            {regions.map((region) => (
              <RegionBracket
                key={region}
                onSelect={setSelectedGameId}
                region={region}
                side={getRegionSide(region)}
                view={view}
              />
            ))}
          </div>
          <FirstFourBracket onSelect={setSelectedGameId} view={view} />
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
              <h3>Model trace</h3>
              {selectedGame.modelTrace.length === 0 ? (
                <p>No model trace was recorded for this game.</p>
              ) : (
                <div className="modal-tool-list">
                  {selectedGame.modelTrace.map((event) => (
                    <article className="trace-card" key={event.id}>
                      {(() => {
                        const defaultExpanded = isTraceExpandedByDefault(
                          event.type,
                        );
                        const isExpanded =
                          (defaultExpanded &&
                            !collapsedTraceEventIds.includes(event.id)) ||
                          expandedTraceEventIds.includes(event.id);
                        const hasExpandableContent =
                          event.arguments !== undefined ||
                          event.result !== undefined ||
                          Boolean(event.content);

                        return (
                          <>
                            <div className="leader-topline">
                              <div>
                                <strong>
                                  {event.type.replaceAll("_", " ")}
                                </strong>
                                {event.toolName ? (
                                  <p>{event.toolName}</p>
                                ) : null}
                              </div>
                              {hasExpandableContent ? (
                                <button
                                  className="trace-toggle"
                                  onClick={() =>
                                    toggleTraceEvent(event.id, defaultExpanded)
                                  }
                                  type="button"
                                >
                                  {isExpanded ? "Minimize" : "Expand"}
                                </button>
                              ) : (
                                <span>
                                  {new Date(
                                    event.createdAt,
                                  ).toLocaleTimeString()}
                                </span>
                              )}
                            </div>
                            {isExpanded ? (
                              <div className="trace-expanded">
                                <p>
                                  {new Date(
                                    event.createdAt,
                                  ).toLocaleTimeString()}
                                </p>
                                {event.arguments !== undefined ? (
                                  <pre className="code-block">
                                    {JSON.stringify(event.arguments, null, 2)}
                                  </pre>
                                ) : null}
                                {event.result !== undefined ? (
                                  <pre className="code-block">
                                    {JSON.stringify(event.result, null, 2)}
                                  </pre>
                                ) : null}
                                {event.content ? (
                                  <pre className="code-block">
                                    {formatTraceContent(
                                      event.type,
                                      event.content,
                                    )}
                                  </pre>
                                ) : null}
                              </div>
                            ) : null}
                          </>
                        );
                      })()}
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
