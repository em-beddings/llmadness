import { LeaderboardTable } from "@/components/leaderboard-table";
import { loadDashboard } from "@/lib/repository";

const RUN_ID = "demo-2026";

export default async function Season2026Page() {
  const dashboard = await loadDashboard(RUN_ID);

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
        modelHrefBase="/2026/models"
        submissions={dashboard.submissions}
      />
    </main>
  );
}
