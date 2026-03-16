import { NextResponse } from "next/server";
import { createAdminRunJob } from "@/lib/admin";
import { TournamentRound } from "@/lib/types";

export const dynamic = "force-dynamic";

const VALID_ROUNDS: TournamentRound[] = [
  "First Four",
  "Round of 64",
  "Round of 32",
  "Sweet 16",
  "Elite 8",
  "Final Four",
  "Championship"
];

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      configFile?: string;
      modelKey?: string;
      round?: TournamentRound;
      slotATeamId?: string;
      slotBTeamId?: string;
      label?: string;
    };

    if (!body.round || !VALID_ROUNDS.includes(body.round)) {
      return NextResponse.json({ error: "Invalid round selected." }, { status: 400 });
    }

    const job = await createAdminRunJob({
      configFile: String(body.configFile ?? ""),
      modelKey: String(body.modelKey ?? ""),
      round: body.round,
      slotATeamId: String(body.slotATeamId ?? ""),
      slotBTeamId: String(body.slotBTeamId ?? ""),
      label: body.label
    });

    return NextResponse.json(job);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create admin job." },
      { status: 500 }
    );
  }
}
