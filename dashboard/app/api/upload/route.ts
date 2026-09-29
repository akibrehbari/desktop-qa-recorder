import { NextResponse } from "next/server";

import { saveRecording } from "@/lib/runsStore";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, recording } = body as { name?: string; recording?: unknown };

    if (!name || typeof name !== "string") {
      return NextResponse.json(
        { error: "Missing required 'name' field" },
        { status: 400 }
      );
    }
    if (!recording) {
      return NextResponse.json(
        { error: "Missing required 'recording' field (JSON document)" },
        { status: 400 }
      );
    }

    const jsonText =
      typeof recording === "string" ? recording : JSON.stringify(recording);
    const fileName = await saveRecording(name, jsonText);

    return NextResponse.json({ file: fileName }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Invalid request";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
