"use client";

import { useCallback, useEffect, useState } from "react";

import type { RecordingState } from "@/lib/types";

function formatElapsed(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export default function RecordPanel({ onFinished }: { onFinished: () => void }) {
  const [state, setState] = useState<RecordingState | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());

  const poll = useCallback(async () => {
    try {
      const res = await fetch("/api/record/status");
      const data = await res.json();
      setState(data.state ?? null);
    } catch {
      // transient network hiccup — next poll will retry
    }
  }, []);

  useEffect(() => {
    void poll();
    const interval = setInterval(() => void poll(), 1500);
    return () => clearInterval(interval);
  }, [poll]);

  useEffect(() => {
    if (!state) return;
    const tick = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(tick);
  }, [state]);

  async function handleStart() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/record/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to start recording");
      setState(data.state);
      setName("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start recording");
    } finally {
      setBusy(false);
    }
  }

  async function handleStop() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/record/stop", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to stop recording");
      setState(null);
      onFinished();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to stop recording");
    } finally {
      setBusy(false);
    }
  }

  const elapsedMs = state ? now - new Date(state.started_at).getTime() : 0;

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <h2 className="mb-3 font-display text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Record a workflow
      </h2>

      {!state ? (
        <div className="space-y-3">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name this recording (optional)"
            className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={handleStart}
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-md bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground transition hover:brightness-110 disabled:opacity-50"
          >
            <span className="h-2.5 w-2.5 rounded-full bg-current" />
            {busy ? "Starting…" : "Start Recording"}
          </button>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Click Start, then do the clicks/typing you want captured. Click
            Stop when you&apos;re done — no terminal needed.
            <br />
            <span className="text-muted-foreground">
              First time on a Mac: a system permission popup may appear
              (Accessibility / Input Monitoring). Click <b>Allow</b>, then
              press Start Recording again.
            </span>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2">
            <span className="flex items-center gap-2 text-sm font-medium text-destructive">
              <span className="h-2.5 w-2.5 animate-pulse rounded-full bg-destructive" />
              Recording &quot;{state.name}&quot;
            </span>
            <span className="font-mono text-sm text-destructive">
              {formatElapsed(elapsedMs)}
            </span>
          </div>
          <button
            onClick={handleStop}
            disabled={busy}
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            {busy ? "Stopping…" : "Stop Recording"}
          </button>
        </div>
      )}

      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}
    </div>
  );
}
