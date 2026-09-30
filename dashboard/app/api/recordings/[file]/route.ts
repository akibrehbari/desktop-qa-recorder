import { NextResponse } from "next/server";

import { deleteRecording } from "@/lib/runsStore";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;
    await deleteRecording(decodeURIComponent(file));
    return NextResponse.json({ deleted: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to delete recording";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
