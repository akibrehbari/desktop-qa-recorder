import { NextResponse } from "next/server";

import { controlRun, type RunControlAction } from "@/lib/runsStore";

const VALID_ACTIONS: RunControlAction[] = ["pause", "resume", "stop"];

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const action = body.action as RunControlAction;

    if (!VALID_ACTIONS.includes(action)) {
      return NextResponse.json(
        { error: `'action' must be one of: ${VALID_ACTIONS.join(", ")}` },
        { status: 400 }
      );
    }

    const run = await controlRun(id, action);
    return NextResponse.json({ run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to control run";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
