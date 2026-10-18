import { useQuery } from "@tanstack/react-query";

import { incidentPageSchema, type IncidentPage } from "../../../shared/contracts";
import { apiFetch } from "../lib/api";

export function useIncidents(repoId: number | null) {
  return useQuery({ queryKey: ["incidents", repoId], queryFn: () => apiFetch<IncidentPage>(`/api/repos/${repoId}/incidents?limit=10`, incidentPageSchema), enabled: repoId !== null, refetchInterval: 10000, refetchIntervalInBackground: false });
}
