export function MetricCard({ title, value, secondary }: { title: string; value: string; secondary?: string }) {
  return <article className="rounded border bg-white p-4 shadow-sm"><h2 className="text-sm font-medium text-slate-600">{title}</h2><p className="mt-2 text-2xl font-semibold">{value}</p>{secondary && <p className="mt-1 text-sm text-slate-500">{secondary}</p>}</article>;
}
