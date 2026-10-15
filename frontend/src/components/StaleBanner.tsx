export function StaleBanner({ onRetry }: { onRetry: () => void }) {
  return <div role="status" className="mb-4 flex items-center justify-between rounded bg-amber-100 p-3 text-amber-900">Data may be stale. <button className="underline" onClick={onRetry}>Retry</button></div>;
}
