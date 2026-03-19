import { LeaderboardTable } from "@/components/leaderboard-table";
import { loadDashboard } from "@/lib/repository";
import Link from "next/link";

const RUN_ID = "2026";

export default async function Season2026Page() {
  const dashboard = await loadDashboard(RUN_ID);

  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">LLMadness</p>
          <h1>{dashboard.config.title}</h1>
        </div>
        <div className="hero-card run-summary-card">
          <strong>AI Tournament Challenge</strong>
          <p>
            {dashboard.manifest.submissions.length} models attempting a perfect
            bracket
          </p>
          <Link href="/about">Methodology</Link>
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
