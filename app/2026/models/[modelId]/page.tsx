import Link from "next/link";
import { BracketBoard } from "@/components/bracket-board";
import { loadDashboard, loadRunManifest, loadSubmissionView } from "@/lib/repository";
import { notFound } from "next/navigation";

const RUN_ID = "2026";
export const dynamicParams = false;

function formatCost(value: number | null | undefined) {
  if (value == null) {
    return "—";
  }

  return `$${value.toFixed(2)}`;
}

export async function generateStaticParams() {
  const manifest = await loadRunManifest(RUN_ID);
  return manifest.submissions.map((submission) => ({
    modelId: submission.modelId,
  }));
}

export default async function ModelPage({
  params,
}: {
  params: Promise<{ modelId: string }>;
}) {
  const { modelId } = await params;
  const [view, dashboard] = await Promise.all([
    loadSubmissionView(RUN_ID, modelId),
    loadDashboard(RUN_ID)
  ]);

  if (!view) {
    notFound();
  }

  const leaderboardEntry = dashboard.leaderboard?.entries.find(
    (entry) => entry.modelId === modelId
  );
  const submissionSummary = dashboard.submissions.find(
    (submission) => submission.modelId === modelId
  );

  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <h1>{view.submission.model.label}</h1>
          <p>
            {view.submission.model.description ?? view.submission.model.model}
          </p>
        </div>
        <Link className="back-link" href="/2026">
          Back to leaderboard
        </Link>
      </section>
      {leaderboardEntry ? (
        <section className="model-summary">
          <div className="stat-chip">
            <strong>{leaderboardEntry.totalPoints}</strong>
            <span className="leader-meta-label">Score</span>
          </div>
          <div className="stat-chip">
            <strong>{Math.round(leaderboardEntry.accuracy * 100)}%</strong>
            <span className="leader-meta-label">Accuracy</span>
          </div>
          <div className="stat-chip">
            <strong>{leaderboardEntry.pointsRemaining}</strong>
            <span className="leader-meta-label">Max score</span>
          </div>
          <div className="stat-chip">
            <strong>{formatCost(leaderboardEntry.totalCostUsd)}</strong>
            <span className="leader-meta-label">Cost</span>
          </div>
          <div className="stat-chip model-summary-pick">
            <strong>{submissionSummary?.championshipPick ?? "Unknown"}</strong>
            <span className="leader-meta-label">Championship pick</span>
          </div>
        </section>
      ) : null}
      <BracketBoard view={view} />
    </main>
  );
}
