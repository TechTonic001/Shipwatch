import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";
import type { Incident } from "./useMetrics";

export function useIncidents(repoId: number | null) {
  return useQuery({ queryKey: ["incidents", repoId], queryFn: () => apiFetch<{ data: Incident[] }>(`/api/repos/${repoId}/incidents?limit=10`), enabled: repoId !== null, refetchInterval: 10000, refetchIntervalInBackground: false });
}
