import Link from "next/link";
import { LeaderboardTable } from "@/components/leaderboard-table";
import { loadDashboard } from "@/lib/repository";

export default async function RunPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const dashboard = await loadDashboard(runId);

  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Run</p>
          <h1>{dashboard.manifest.title}</h1>
          <p>{dashboard.config.title}</p>
        </div>
      </section>

      <LeaderboardTable leaderboard={dashboard.leaderboard} runId={runId} />

      <section className="panel">
        <div className="section-header">
          <h2>Submitted Brackets</h2>
          <p>Open any model to inspect its full bracket and trace.</p>
        </div>
        <div className="model-grid">
          {dashboard.manifest.submissions.map((submission) => (
            <Link className="model-card" href={`/runs/${runId}/models/${submission.modelId}`} key={submission.modelId}>
              <span>Model</span>
              <strong>{submission.modelId}</strong>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
