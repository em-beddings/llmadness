import Link from "next/link";
import { SubmissionSummary } from "@/lib/repository";
import { Leaderboard } from "@/lib/types";

function getSummary(modelId: string, submissions: SubmissionSummary[]) {
  return submissions.find((entry) => entry.modelId === modelId);
}

function getProviderLabel(summary?: SubmissionSummary) {
  const description = summary?.description;
  if (!description) {
    return null;
  }

  const [provider] = description.split("•").map((part) => part.trim());
  return provider || null;
}

export function LeaderboardTable({
  leaderboard,
  modelHrefBase,
  submissions,
}: {
  leaderboard: Leaderboard | null;
  modelHrefBase: string;
  submissions: SubmissionSummary[];
}) {
  if (!leaderboard) {
    return (
      <section className="panel leaderboard-panel">
        <h2>Leaderboard</h2>
        <p>No scoring file has been generated for this run yet.</p>
      </section>
    );
  }

  const podium = leaderboard.entries.slice(0, 3);
  const field = leaderboard.entries.slice(3);

  return (
    <section className="panel leaderboard-panel">
      <div className="section-header">
        <div>
          <h2>Leaderboard</h2>
        </div>
        <p>Round-weighted scoring with title picks called out.</p>
      </div>

      <div className="podium-grid">
        {podium.map((entry, index) => {
          const summary = getSummary(entry.modelId, submissions);
          const providerLabel = getProviderLabel(summary);
          return (
            <Link
              className={`podium-card podium-card-${index + 1}`}
              href={`${modelHrefBase}/${entry.modelId}`}
              key={entry.modelId}
            >
              <div className="podium-rank">#{index + 1}</div>
              <div>
                <h3>
                  {entry.modelLabel}
                  {providerLabel ? (
                    <span className="leader-provider">{providerLabel}</span>
                  ) : null}
                </h3>
              </div>
              <div className="podium-score">
                <strong>{entry.totalPoints}</strong>
                <span className="score-available">/ {entry.maxPoints}</span>
              </div>
              <div className="podium-meta">
                <span>{Math.round(entry.accuracy * 100)}% accuracy</span>
                <span>
                  <span className="leader-meta-label">Max</span>{" "}
                  {entry.pointsRemaining}
                </span>
              </div>
              {summary?.championshipMatchup ? (
                <div className="leaderboard-matchup">
                  <div
                    className={`bracket-team ${summary.championshipMatchup.winner === summary.championshipMatchup.slotA ? "bracket-team-winner" : ""}`}
                  >
                    <span>{summary.championshipMatchup.slotA}</span>
                  </div>
                  <div
                    className={`bracket-team ${summary.championshipMatchup.winner === summary.championshipMatchup.slotB ? "bracket-team-winner" : ""}`}
                  >
                    <span>{summary.championshipMatchup.slotB}</span>
                  </div>
                </div>
              ) : null}
              <div className="leader-bottomline leader-bottomline-nowrap">
                <span>Championship pick</span>
                <strong>{summary?.championshipPick ?? "Unknown"}</strong>
              </div>
            </Link>
          );
        })}
      </div>

      <div className="leaderboard-cards">
        {field.map((entry, index) => {
          const summary = getSummary(entry.modelId, submissions);
          const providerLabel = getProviderLabel(summary);
          return (
            <Link
              className="leader-card"
              href={`${modelHrefBase}/${entry.modelId}`}
              key={entry.modelId}
            >
              <div className="leader-rank">#{index + 4}</div>
              <div className="leader-topline">
                <strong>
                  {entry.modelLabel}
                  {providerLabel ? (
                    <span className="leader-provider">{providerLabel}</span>
                  ) : null}
                </strong>
              </div>
              <div className="leader-points">
                <strong>{entry.totalPoints}</strong>
                <span className="score-available">/ {entry.maxPoints}</span>
              </div>
              <div className="leader-accuracy">
                <span>{Math.round(entry.accuracy * 100)}%</span>
              </div>
              <div className="leader-remaining">
                <strong>{entry.pointsRemaining}</strong>
                <span className="leader-meta-label">Max</span>
              </div>
              <div className="leader-bottomline leader-bottomline-nowrap">
                <strong>{summary?.championshipPick ?? "Unknown"}</strong>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
