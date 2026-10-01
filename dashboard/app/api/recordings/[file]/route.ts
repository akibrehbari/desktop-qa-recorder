import { NextResponse } from "next/server";

import { deleteRecording, renameRecording } from "@/lib/runsStore";

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

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ file: string }> }
) {
  try {
    const { file } = await params;
    const body = await req.json().catch(() => ({}));
    if (typeof body.name !== "string") {
      return NextResponse.json(
        { error: "Missing required 'name' field" },
        { status: 400 }
      );
    }
    const recording = await renameRecording(decodeURIComponent(file), body.name);
    return NextResponse.json({ recording });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to rename recording";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
