"use client";

import { useRef, useState } from "react";

export default function UploadButton({ onUploaded }: { onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const name = parsed.name ?? file.name.replace(/\.json$/, "");

      const res = await fetch("/api/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, recording: parsed }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Upload failed");
      }

      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="inline-flex cursor-pointer items-center justify-center rounded-md bg-accent/90 px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-accent">
        {busy ? "Uploading…" : "Upload recording"}
        <input
          ref={inputRef}
          type="file"
          accept="application/json"
          className="hidden"
          disabled={busy}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleFile(file);
          }}
        />
      </label>
      {error && <span className="text-xs text-red-400">{error}</span>}
    </div>
  );
}
