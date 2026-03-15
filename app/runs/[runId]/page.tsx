import { LeaderboardTable } from "@/components/leaderboard-table";
import { loadDashboard } from "@/lib/repository";

export default async function RunPage({
  params,
}: {
  params: Promise<{ runId: string }>;
}) {
  const { runId } = await params;
  const dashboard = await loadDashboard(runId);

  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <h1>{dashboard.config.title}</h1>
        </div>
        <div className="hero-card run-summary-card">
          <span>Field snapshot</span>
          <strong>{dashboard.config.teams.length} teams</strong>
          <p>
            {dashboard.manifest.submissions.length} models competing across{" "}
            {dashboard.config.games.length} games.
          </p>
        </div>
      </section>

      <LeaderboardTable
        leaderboard={dashboard.leaderboard}
        runId={runId}
        submissions={dashboard.submissions}
      />
    </main>
  );
}
