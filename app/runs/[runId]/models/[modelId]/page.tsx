import Link from "next/link";
import { BracketBoard } from "@/components/bracket-board";
import { TracePanel } from "@/components/trace-panel";
import { loadSubmissionView } from "@/lib/repository";
import { notFound } from "next/navigation";

export default async function ModelPage({
  params
}: {
  params: Promise<{ runId: string; modelId: string }>;
}) {
  const { runId, modelId } = await params;
  const view = await loadSubmissionView(runId, modelId);

  if (!view) {
    notFound();
  }

  return (
    <main className="shell">
      <section className="page-header">
        <div>
          <p className="eyebrow">Bracket View</p>
          <h1>{view.submission.model.label}</h1>
          <p>{view.submission.model.description ?? view.submission.model.model}</p>
        </div>
        <Link className="back-link" href={`/runs/${runId}`}>
          Back to run
        </Link>
      </section>
      <BracketBoard view={view} />
      <TracePanel steps={view.submission.reasoning} />
    </main>
  );
}
