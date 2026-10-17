export function StaleBanner({ onRetry }: { onRetry: () => void }) {
  return <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-console border border-warning/50 bg-warning/10 px-4 py-3 text-sm"><p><span aria-hidden="true">◷ </span>Showing data from 2m ago, reconnecting…</p><button type="button" className="rounded border border-warning/50 px-3 py-1.5 hover:bg-warning/10" onClick={onRetry}>Retry now</button></div>;
}
