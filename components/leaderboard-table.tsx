import Link from "next/link";
import { SubmissionSummary } from "@/lib/repository";
import { Leaderboard } from "@/lib/types";

function getSummary(modelId: string, submissions: SubmissionSummary[]) {
  return submissions.find((entry) => entry.modelId === modelId);
}

export function LeaderboardTable({
  leaderboard,
  runId,
  submissions,
}: {
  leaderboard: Leaderboard | null;
  runId: string;
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
          <p className="eyebrow">Standings</p>
          <h2>Leaderboard</h2>
        </div>
        <p>Round-weighted scoring with title picks called out.</p>
      </div>

      <div className="podium-grid">
        {podium.map((entry, index) => {
          const summary = getSummary(entry.modelId, submissions);
          return (
            <Link
              className={`podium-card podium-card-${index + 1}`}
              href={`/runs/${runId}/models/${entry.modelId}`}
              key={entry.modelId}
            >
              <div className="podium-rank">#{index + 1}</div>
              <div>
                <p className="podium-label">Model</p>
                <h3>{entry.modelLabel}</h3>
              </div>
              <div className="podium-score">
                <strong>{entry.totalPoints}</strong>
                <span>/ {entry.maxPoints}</span>
              </div>
              <div className="podium-meta">
                <span>{Math.round(entry.accuracy * 100)}% accuracy</span>
                <span>{summary?.championshipPick ?? "No title pick"}</span>
              </div>
              {summary?.finalFourPicks?.length ? (
                <div className="pick-chip-row">
                  {summary.finalFourPicks.map((team) => (
                    <span
                      className="pick-chip"
                      key={`${entry.modelId}-${team}`}
                    >
                      {team}
                    </span>
                  ))}
                </div>
              ) : null}
            </Link>
          );
        })}
      </div>

      <div className="leaderboard-cards">
        {field.map((entry) => {
          const summary = getSummary(entry.modelId, submissions);
          return (
            <Link
              className="leader-card"
              href={`/runs/${runId}/models/${entry.modelId}`}
              key={entry.modelId}
            >
              <div className="leader-topline">
                <strong>{entry.modelLabel}</strong>
                <span>{Math.round(entry.accuracy * 100)}%</span>
              </div>
              <div className="leader-points">
                {entry.totalPoints} / {entry.maxPoints}
              </div>
              <div className="leader-bottomline">
                <span>Championship pick</span>
                <strong>{summary?.championshipPick ?? "Unknown"}</strong>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
