import { NextResponse } from "next/server";
import { loadAdminJob } from "@/lib/admin";

export async function GET(_request: Request, context: { params: Promise<{ jobId: string }> }) {
  try {
    const { jobId } = await context.params;
    const job = await loadAdminJob(jobId);
    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to load admin job." },
      { status: 404 }
    );
  }
}
