export type MetricWindow = "7d" | "30d";

export function WindowToggle({ value, onChange }: { value: MetricWindow; onChange: (window: MetricWindow) => void }) {
  return <div role="group" aria-label="Metric window" className="inline-flex rounded border border-border bg-surface p-1">{(["7d", "30d"] as const).map((window) => <button key={window} type="button" aria-pressed={value === window} className={`min-w-12 rounded px-3 py-1.5 text-sm ${value === window ? "bg-raised text-text" : "text-muted hover:text-text"}`} onClick={() => onChange(window)}>{window}</button>)}</div>;
}
