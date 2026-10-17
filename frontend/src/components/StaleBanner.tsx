export function StaleBanner({ onRetry, updatedAt }: { onRetry: () => void; updatedAt: number }) {
  const seconds = Math.max(0, Math.floor((Date.now() - updatedAt) / 1000));
  const age = seconds < 60 ? `${seconds}s` : seconds < 3600 ? `${Math.floor(seconds / 60)}m` : `${Math.floor(seconds / 3600)}h`;
  return <div role="status" className="flex flex-wrap items-center justify-between gap-3 rounded-console border border-warning/50 bg-warning/10 px-4 py-3 text-sm"><p><span aria-hidden="true">◷ </span>Showing data from {age} ago, reconnecting…</p><button type="button" className="rounded border border-warning/50 px-3 py-1.5 hover:bg-warning/10" onClick={onRetry}>Retry now</button></div>;
}
