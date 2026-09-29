import { NextResponse } from "next/server";

import { getRecording, getRun } from "@/lib/runsStore";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const run = await getRun(id);
  if (!run) {
    return NextResponse.json({ error: "Run not found" }, { status: 404 });
  }

  const recording = await getRecording(run.recording_name);
  return NextResponse.json({ run, recording });
}
