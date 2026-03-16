import Link from "next/link";
import Image from "next/image";
import { loadDashboard } from "@/lib/repository";
import { LeaderboardTable } from "@/components/leaderboard-table";

const DEFAULT_RUN_ID = "demo-2026";

export default async function HomePage() {
  const dashboard = await loadDashboard(DEFAULT_RUN_ID);

  return (
    <main className="shell">
      <section className="hero">
        <div>
          <div className="brand-header">
            <Image alt="" aria-hidden="true" className="brand-icon" height={16} src="/icon.svg" width={16} />
            <p className="eyebrow">LLMadness</p>
          </div>
          <h1>Agent arena for March Madness brackets.</h1>
          <p className="hero-copy">
            Run multiple foundation models against the same tournament snapshot, store each full bracket plus reasoning trace as JSON, and compare them live once games start.
          </p>
          <div className="hero-stats">
            <div className="stat-chip">
              <strong>{dashboard.config.teams.length}</strong>
              <span>teams</span>
            </div>
            <div className="stat-chip">
              <strong>{dashboard.config.games.length}</strong>
              <span>games</span>
            </div>
            <div className="stat-chip">
              <strong>{dashboard.manifest.submissions.length}</strong>
              <span>models</span>
            </div>
          </div>
        </div>
        <div className="hero-card">
          <span>Current run</span>
          <strong>{dashboard.manifest.title}</strong>
          <p>{dashboard.config.title}</p>
          <Link href={`/runs/${dashboard.manifest.id}`}>Open dashboard</Link>
        </div>
      </section>
      <LeaderboardTable
        leaderboard={dashboard.leaderboard}
        runId={dashboard.manifest.id}
        submissions={dashboard.submissions}
      />
    </main>
  );
}
