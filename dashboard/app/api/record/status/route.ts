import { NextResponse } from "next/server";

import { getRecordingStatus } from "@/lib/runsStore";

export async function GET() {
  const state = await getRecordingStatus();
  return NextResponse.json({ state });
}
