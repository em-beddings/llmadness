import { SubmissionView } from "@/lib/repository";

export function BracketBoard({ view }: { view: SubmissionView }) {
  return (
    <div className="bracket-grid">
      {view.gamesByRound.map((round) => (
        <section className="round-column" key={round.round}>
          <div className="round-header">
            <h3>{round.round}</h3>
            <span>{round.games.length} games</span>
          </div>
          {round.games.map((game) => (
            <article className="game-card" key={game.id}>
              <div className="game-card-top">
                <span>{game.label}</span>
                {game.region ? <span>{game.region}</span> : null}
              </div>
              <div className="team-row">{game.slotA}</div>
              <div className="team-row">{game.slotB}</div>
              <div className="winner-row">
                <strong>{game.winner ?? "Pending"}</strong>
                {game.confidence !== null ? <span>{Math.round(game.confidence * 100)}%</span> : null}
              </div>
              {game.rationale ? <p className="rationale">{game.rationale}</p> : null}
            </article>
          ))}
        </section>
      ))}
    </div>
  );
}
