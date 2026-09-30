import { NextResponse } from "next/server";

import { startRecording } from "@/lib/runsStore";

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const name = typeof body.name === "string" && body.name.trim()
      ? body.name.trim()
      : `recording-${Date.now()}`;

    const state = await startRecording(name);
    return NextResponse.json({ state }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to start recording";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
