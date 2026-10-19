const DEPLOYED_BACKEND_URL = "https://shipwatchbackend.vercel.app";

export function EmptyState() {
  const apiUrl = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? DEPLOYED_BACKEND_URL : "http://localhost:3100");
  return <section className="rounded-console border border-dashed border-border bg-surface p-8 text-center" aria-labelledby="empty-heading">
    <span aria-hidden="true" className="mx-auto grid h-11 w-11 place-items-center rounded-full border border-border text-lg text-muted">↗</span>
    <h2 id="empty-heading" className="mt-4 text-lg font-semibold">Your delivery data will appear here</h2>
    <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-muted">Connect a repository by adding its webhook in GitHub. Shipwatch will populate this view as deployment events arrive.</p>
    <div className="mx-auto mt-5 max-w-xl rounded border border-border bg-background p-4 text-left"><p className="text-xs font-medium uppercase text-muted">Webhook URL pattern</p><code className="mt-2 block break-all font-mono text-sm text-text">{apiUrl.replace(/\/$/, "")}/api/webhooks/github</code></div>
  </section>;
}
