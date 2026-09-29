import { NextResponse } from "next/server";

import { listRecordings } from "@/lib/runsStore";

export async function GET() {
  const recordings = await listRecordings();
  return NextResponse.json({ recordings });
}
