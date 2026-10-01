import type { RunStatus } from "@/lib/types";

const STYLES: Record<RunStatus, string> = {
  passed: "bg-primary/15 text-primary ring-primary/30",
  failed: "bg-destructive/15 text-destructive ring-destructive/30",
  aborted: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
  running: "bg-sky-500/15 text-sky-400 ring-sky-500/30 animate-pulse",
  paused: "bg-violet-500/15 text-violet-400 ring-violet-500/30",
};

export default function StatusBadge({ status }: { status: RunStatus }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${STYLES[status]}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {status}
    </span>
  );
}
