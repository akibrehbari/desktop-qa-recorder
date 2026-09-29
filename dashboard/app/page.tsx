"use client";

import { useCallback, useEffect, useState } from "react";

import RunList from "@/components/RunList";
import UploadButton from "@/components/UploadButton";
import type { RecordingSummary, RunRecord } from "@/lib/types";

const SPEED_OPTIONS = [0.5, 1, 1.5, 2, 4];

export default function DashboardPage() {
  const [recordings, setRecordings] = useState<RecordingSummary[]>([]);
  const [runs, setRuns] = useState<RunRecord[]>([]);
  const [speed, setSpeed] = useState(1);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const [recRes, runRes] = await Promise.all([
      fetch("/api/recordings"),
      fetch("/api/runs"),
    ]);
    const recData = await recRes.json();
    const runData = await runRes.json();
    setRecordings(recData.recordings ?? []);
    setRuns(runData.runs ?? []);
  }, []);

  useEffect(() => {
    void refresh();
    const interval = setInterval(() => void refresh(), 3000);
    return () => clearInterval(interval);
  }, [refresh]);

  async function trigger(file: string) {
    setTriggering(file);
    setToast(null);
    try {
      const res = await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recordingFile: file, speed }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to trigger run");
      setToast(`Started run ${data.run.id.slice(0, 8)} for ${file}`);
      await refresh();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to trigger run");
    } finally {
      setTriggering(null);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-100">
            QA Recorder Dashboard
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Deterministic desktop workflow recording & replay for UI testing.
          </p>
        </div>
        <UploadButton onUploaded={refresh} />
      </header>

      {toast && (
        <div className="mb-6 rounded-md bg-panel px-4 py-2 text-sm text-slate-300 ring-1 ring-border">
          {toast}
        </div>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[320px_1fr]">
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">
              Recordings
            </h2>
            <select
              value={speed}
              onChange={(e) => setSpeed(Number(e.target.value))}
              className="rounded-md border border-border bg-panel px-2 py-1 text-xs text-slate-300"
            >
              {SPEED_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}x
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-3">
            {recordings.length === 0 && (
              <p className="rounded-md border border-dashed border-border p-4 text-sm text-slate-400">
                No recordings found in <code>recordings/</code>. Record one
                with the CLI or upload a JSON file.
              </p>
            )}
            {recordings.map((rec) => (
              <div
                key={rec.file}
                className="rounded-lg bg-panel p-4 ring-1 ring-border"
              >
                <p className="font-medium text-slate-200">{rec.name}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {rec.events_count} events · {(rec.duration_ms / 1000).toFixed(2)}s ·{" "}
                  {rec.platform}
                </p>
                <button
                  onClick={() => trigger(rec.file)}
                  disabled={triggering === rec.file}
                  className="mt-3 w-full rounded-md bg-accent/90 px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-accent disabled:opacity-50"
                >
                  {triggering === rec.file ? "Starting…" : `Run at ${speed}x`}
                </button>
              </div>
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-slate-400">
            Test Runs
          </h2>
          <RunList runs={runs} />
        </section>
      </div>
    </main>
  );
}
