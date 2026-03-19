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
          <div className="model-summary-item">
            <span className="leader-meta-label">Score</span>
            <strong>{leaderboardEntry.totalPoints}</strong>
          </div>
          <div className="model-summary-item">
            <span className="leader-meta-label">Accuracy</span>
            <strong>{Math.round(leaderboardEntry.accuracy * 100)}%</strong>
          </div>
          <div className="model-summary-item">
            <span className="leader-meta-label">Max score</span>
            <strong>{leaderboardEntry.pointsRemaining}</strong>
          </div>
          <div className="model-summary-item">
            <span className="leader-meta-label">Cost</span>
            <strong>{formatCost(leaderboardEntry.totalCostUsd)}</strong>
          </div>
          <div className="model-summary-item model-summary-pick">
            <span className="leader-meta-label">Championship pick</span>
            <strong>{submissionSummary?.championshipPick ?? "Unknown"}</strong>
          </div>
        </section>
      ) : null}
      <BracketBoard view={view} />
    </main>
  );
}
