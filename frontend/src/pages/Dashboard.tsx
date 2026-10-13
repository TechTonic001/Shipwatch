import { IncidentList } from "../components/IncidentList";
import { RunsTable } from "../components/RunsTable";

export function Dashboard() {
  // TODO: Compose polling hooks and dashboard components.
  return (
    <main>
      <h1>Shipwatch</h1>
      <IncidentList />
      <RunsTable />
    </main>
  );
}
