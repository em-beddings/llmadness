import Link from "next/link";
import { BracketBoard } from "@/components/bracket-board";
import { loadRunManifest, loadSubmissionView } from "@/lib/repository";
import { notFound } from "next/navigation";

const RUN_ID = "2026";
export const dynamicParams = false;

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
  const view = await loadSubmissionView(RUN_ID, modelId);

  if (!view) {
    notFound();
  }

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
      <BracketBoard view={view} />
    </main>
  );
}
