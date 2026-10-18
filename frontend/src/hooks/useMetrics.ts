import { useQuery } from "@tanstack/react-query";

import { metricsResponseSchema, type MetricsResponse } from "../../../shared/contracts";
import { apiFetch } from "../lib/api";

export type Metrics = MetricsResponse;
export type Incident = Metrics["openIncidents"][number];

export function useMetrics(repoId: number | null, window: "7d" | "30d") {
  return useQuery({
    queryKey: ["metrics", repoId, window],
    queryFn: () => apiFetch<MetricsResponse>(`/api/repos/${repoId}/metrics?window=${window}`, metricsResponseSchema),
    enabled: repoId !== null,
    refetchInterval: 10000,
    refetchIntervalInBackground: false
  });
}
