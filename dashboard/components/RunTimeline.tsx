import type { InputEvent } from "@/lib/types";

const TYPE_COLOR: Record<InputEvent["type"], string> = {
  move: "bg-slate-500",
  click: "bg-accent",
  scroll: "bg-violet-400",
  key_down: "bg-amber-400",
  key_up: "bg-amber-600",
};

function describe(event: InputEvent): string {
  switch (event.type) {
    case "move":
      return `move → (${event.x}, ${event.y})`;
    case "click":
      return `${event.pressed ? "press" : "release"} ${event.button} @ (${event.x}, ${event.y})`;
    case "scroll":
      return `scroll (${event.dx}, ${event.dy}) @ (${event.x}, ${event.y})`;
    case "key_down":
      return `key down '${event.key}'`;
    case "key_up":
      return `key up '${event.key}'`;
    default:
      return event.type;
  }
}

export default function RunTimeline({ events }: { events: InputEvent[] }) {
  const durationMs = events.length ? Math.max(...events.map((e) => e.t)) : 0;

  if (events.length === 0) {
    return <p className="text-sm text-slate-400">No events recorded.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="relative h-10 w-full rounded-md bg-panel ring-1 ring-border">
        {events.map((event, i) => (
          <div
            key={i}
            title={`${describe(event)} @ ${event.t.toFixed(0)}ms`}
            className={`absolute top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full ${TYPE_COLOR[event.type]}`}
            style={{
              left: `${durationMs === 0 ? 0 : (event.t / durationMs) * 100}%`,
            }}
          />
        ))}
      </div>

      <ol className="max-h-72 space-y-1 overflow-y-auto pr-2 text-sm">
        {events.map((event, i) => (
          <li
            key={i}
            className="flex items-center justify-between gap-4 rounded px-2 py-1 odd:bg-white/[0.02]"
          >
            <span className="flex items-center gap-2 text-slate-300">
              <span className={`h-2 w-2 rounded-full ${TYPE_COLOR[event.type]}`} />
              {describe(event)}
            </span>
            <span className="shrink-0 font-mono text-xs text-slate-500">
              {event.t.toFixed(1)}ms
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
