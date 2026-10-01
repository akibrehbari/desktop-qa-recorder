export default function Header() {
  return (
    <div className="pointer-events-none fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div
        className="pointer-events-auto flex max-w-full items-center gap-3 rounded-full border border-border bg-background/80 py-2 pr-4 pl-4 shadow-soft backdrop-blur-xl backdrop-saturate-150"
        aria-label="eLeopards QA Recorder"
      >
        <span className="flex min-w-0 items-center gap-2 font-display text-sm font-bold tracking-tight">
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-primary" />
          <span className="truncate">eLeopards</span>
        </span>
        <span className="h-4 w-px shrink-0 bg-border" aria-hidden="true" />
        <span className="truncate text-sm text-muted-foreground">QA Recorder</span>
      </div>
    </div>
  );
}
