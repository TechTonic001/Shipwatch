import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function DeploymentChart({ data }: { data: { date: string; count: number }[] }) {
  return <section className="rounded border bg-white p-4"><h2 className="mb-3 text-lg font-semibold">Deployments per day</h2><div className="h-64"><ResponsiveContainer><BarChart data={data}><XAxis dataKey="date" /><YAxis allowDecimals={false} /><Tooltip /><Bar dataKey="count" fill="#2563eb" name="Successful deployments" /></BarChart></ResponsiveContainer></div></section>;
}
