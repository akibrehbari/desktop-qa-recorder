import { NextResponse } from "next/server";

import { stopRecording } from "@/lib/runsStore";

export async function POST() {
  try {
    const result = await stopRecording();
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to stop recording";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
