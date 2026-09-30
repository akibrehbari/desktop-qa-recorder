"use client";

import { Fragment, useState } from "react";

import type { InputEvent, RunRecord } from "@/lib/types";

import RunTimeline from "./RunTimeline";
import StatusBadge from "./StatusBadge";

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function RunList({
  runs,
  onChanged,
}: {
  runs: RunRecord[];
  onChanged?: () => void;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [events, setEvents] = useState<InputEvent[] | null>(null);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [controllingId, setControllingId] = useState<string | null>(null);
  const [controlError, setControlError] = useState<string | null>(null);

  async function toggleExpand(run: RunRecord) {
    if (expandedId === run.id) {
      setExpandedId(null);
      setEvents(null);
      return;
    }
    setExpandedId(run.id);
    setEvents(null);
    setLoadingId(run.id);
    try {
      const res = await fetch(`/api/runs/${run.id}`);
      const data = await res.json();
      setEvents(data.recording?.events ?? []);
    } finally {
      setLoadingId(null);
    }
  }

  async function control(
    e: React.MouseEvent,
    run: RunRecord,
    action: "pause" | "resume" | "stop"
  ) {
    e.stopPropagation();
    setControllingId(run.id);
    setControlError(null);
    try {
      const res = await fetch(`/api/runs/${run.id}/control`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? `Failed to ${action} run`);
      onChanged?.();
    } catch (err) {
      setControlError(err instanceof Error ? err.message : `Failed to ${action} run`);
    } finally {
      setControllingId(null);
    }
  }

  if (runs.length === 0) {
    return (
      <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-slate-400">
        No test runs yet. Trigger a recording from the left panel to see it here.
      </p>
    );
  }

  return (
    <div className="overflow-hidden rounded-lg ring-1 ring-border">
      {controlError && (
        <p className="border-b border-border bg-red-500/10 px-4 py-2 text-xs text-red-300">
          {controlError}
        </p>
      )}
      <table className="w-full text-left text-sm">
        <thead className="bg-panel text-xs uppercase tracking-wide text-slate-400">
          <tr>
            <th className="px-4 py-3 font-medium">Recording</th>
            <th className="px-4 py-3 font-medium">Status</th>
            <th className="px-4 py-3 font-medium">Speed</th>
            <th className="px-4 py-3 font-medium">Events</th>
            <th className="px-4 py-3 font-medium">Duration</th>
            <th className="px-4 py-3 font-medium">Started</th>
            <th className="px-4 py-3 font-medium">Actions</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run) => (
            <Fragment key={run.id}>
              <tr
                onClick={() => toggleExpand(run)}
                className="cursor-pointer border-t border-border bg-surface transition hover:bg-white/[0.02]"
              >
                <td className="px-4 py-3 font-medium text-slate-200">
                  {run.recording_name}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={run.status} />
                </td>
                <td className="px-4 py-3 text-slate-400">{run.speed}x</td>
                <td className="px-4 py-3 text-slate-400">
                  {run.events_played}/{run.events_total}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {formatDuration(run.duration_ms)}
                </td>
                <td className="px-4 py-3 text-slate-400">
                  {formatTime(run.started_at)}
                </td>
                <td className="px-4 py-3">
                  {(run.status === "running" || run.status === "paused") && (
                    <div className="flex gap-1.5">
                      {run.status === "running" && (
                        <button
                          onClick={(e) => control(e, run, "pause")}
                          disabled={controllingId === run.id}
                          className="rounded-md bg-violet-500/15 px-2 py-1 text-xs font-medium text-violet-300 ring-1 ring-violet-500/30 transition hover:bg-violet-500/25 disabled:opacity-50"
                        >
                          Pause
                        </button>
                      )}
                      {run.status === "paused" && (
                        <button
                          onClick={(e) => control(e, run, "resume")}
                          disabled={controllingId === run.id}
                          className="rounded-md bg-sky-500/15 px-2 py-1 text-xs font-medium text-sky-300 ring-1 ring-sky-500/30 transition hover:bg-sky-500/25 disabled:opacity-50"
                        >
                          Resume
                        </button>
                      )}
                      <button
                        onClick={(e) => control(e, run, "stop")}
                        disabled={controllingId === run.id}
                        className="rounded-md bg-red-500/15 px-2 py-1 text-xs font-medium text-red-300 ring-1 ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                      >
                        Stop
                      </button>
                    </div>
                  )}
                </td>
              </tr>
              {expandedId === run.id && (
                <tr className="border-t border-border bg-panel/60">
                  <td colSpan={7} className="px-4 py-4">
                    {run.error && (
                      <p className="mb-3 rounded bg-red-500/10 px-3 py-2 text-xs text-red-300">
                        {run.error}
                      </p>
                    )}
                    {loadingId === run.id && (
                      <p className="text-sm text-slate-400">Loading timeline…</p>
                    )}
                    {events && <RunTimeline events={events} />}
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
