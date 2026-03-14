import Link from "next/link";
import { Leaderboard } from "@/lib/types";

export function LeaderboardTable({
  leaderboard,
  runId
}: {
  leaderboard: Leaderboard | null;
  runId: string;
}) {
  if (!leaderboard) {
    return (
      <section className="panel">
        <h2>Leaderboard</h2>
        <p>No scoring file has been generated for this run yet.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="section-header">
        <h2>Leaderboard</h2>
        <p>Scored brackets rank by round-weighted points.</p>
      </div>
      <table className="leaderboard">
        <thead>
          <tr>
            <th>Model</th>
            <th>Points</th>
            <th>Accuracy</th>
          </tr>
        </thead>
        <tbody>
          {leaderboard.entries.map((entry) => (
            <tr key={entry.modelId}>
              <td>
                <Link href={`/runs/${runId}/models/${entry.modelId}`}>{entry.modelLabel}</Link>
              </td>
              <td>
                {entry.totalPoints} / {entry.maxPoints}
              </td>
              <td>{Math.round(entry.accuracy * 100)}%</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
