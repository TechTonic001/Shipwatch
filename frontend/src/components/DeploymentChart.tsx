import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Day = { date: string; count: number };

export function DeploymentChart({ data }: { data: Day[] }) {
  const [asTable, setAsTable] = useState(false);
  return (
    <section className="rounded-console border border-border bg-surface p-5" aria-labelledby="deployments-heading">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><h2 id="deployments-heading" className="text-base font-semibold">Deployments per day</h2><p className="mt-1 text-sm text-muted">Successful production deployments</p></div>
        <button type="button" className="rounded border border-border px-3 py-2 text-sm hover:bg-raised" aria-pressed={asTable} onClick={() => setAsTable((value) => !value)}>{asTable ? "View chart" : "View as table"}</button>
      </div>
      {asTable ? (
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><caption className="sr-only">Successful deployments by UTC day</caption><thead><tr className="border-b border-border text-muted"><th scope="col" className="py-2">UTC date</th><th scope="col" className="py-2 text-right">Successful deployments</th></tr></thead><tbody>{data.map((day) => <tr key={day.date} className="border-b border-border/60 last:border-0"><td className="py-2">{day.date}</td><td className="py-2 text-right font-mono tabular-nums">{day.count}</td></tr>)}</tbody></table></div>
      ) : (
        <div className="mt-5 h-64" role="img" aria-label="Bar chart of successful production deployments by day">
          <ResponsiveContainer width="100%" height="100%"><BarChart data={data} margin={{ top: 8, right: 8, left: -18, bottom: 0 }}>
            <CartesianGrid stroke="rgb(var(--color-border))" vertical={false} />
            <XAxis dataKey="date" tickFormatter={(value: string) => value.slice(5)} tick={{ fill: "rgb(var(--color-muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <YAxis allowDecimals={false} tick={{ fill: "rgb(var(--color-muted))", fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: "rgb(var(--color-surface))", border: "1px solid rgb(var(--color-border))", borderRadius: 8, color: "rgb(var(--color-text))" }} labelStyle={{ color: "rgb(var(--color-muted))" }} />
            <Legend />
            <Bar dataKey="count" name="Successful" fill="rgb(var(--color-success))" radius={[4, 4, 0, 0]} maxBarSize={30} />
          </BarChart></ResponsiveContainer>
        </div>
      )}
      <p className="mt-3 text-xs text-muted">Failed deployment counts are not included in this API response.</p>
    </section>
  );
}
