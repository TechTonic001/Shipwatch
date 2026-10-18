import { useState, type FormEvent } from "react";

import { setDashboardToken } from "../lib/api";

export function TokenGate({ unauthorized, onSaved }: { unauthorized: boolean; onSaved: () => void }) {
  const [token, setToken] = useState("");
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDashboardToken(token);
    onSaved();
  }
  return <main className="grid min-h-screen place-items-center bg-background p-5">
    <section className="w-full max-w-md rounded-console border border-border bg-surface p-7">
      <p className="font-mono text-xs uppercase text-accent">Shipwatch · Read access</p><h1 className="mt-3 text-2xl font-semibold">Connect your dashboard</h1>
      <p className="mt-3 text-sm leading-6 text-muted">Enter the dashboard read token configured by your Shipwatch administrator as <code className="font-mono text-text">DASHBOARD_READ_TOKEN</code>. It is stored in this browser session only and never added to the URL.</p>
      {unauthorized && <p className="mt-4 rounded border border-danger/40 bg-danger/10 p-3 text-sm text-danger" role="alert">That token was not accepted. Check it and try again.</p>}
      <form className="mt-6 space-y-4" onSubmit={submit}><label className="block text-sm font-medium" htmlFor="dashboard-token">Read token</label><input autoComplete="off" className="w-full rounded border border-border bg-background px-3 py-2.5 text-text" id="dashboard-token" name="dashboard-token" type="password" value={token} onChange={(event) => setToken(event.target.value)} required /><button className="w-full rounded bg-accent px-4 py-2.5 font-medium text-background hover:brightness-110" type="submit">Open dashboard</button></form>
    </section>
  </main>;
}
