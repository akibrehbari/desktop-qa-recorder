import { NextResponse } from "next/server";

import { triggerReplay } from "@/lib/runsStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { recordingFile, speed } = body as {
      recordingFile?: string;
      speed?: number;
    };

    if (!recordingFile || typeof recordingFile !== "string") {
      return NextResponse.json(
        { error: "Missing required 'recordingFile' field" },
        { status: 400 }
      );
    }

    const run = await triggerReplay(recordingFile, speed ?? 1.0);
    return NextResponse.json({ run }, { status: 202 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to trigger run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
