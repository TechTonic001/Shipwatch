import { useQuery } from "@tanstack/react-query";

import { metricsResponseSchema, type MetricsResponse } from "../../../shared/contracts";
import { apiFetch } from "../lib/api";

export type Incident = { id: string; environment: string; openedAt: string; ageSeconds: number; status?: "open" | "resolved"; resolvedAt?: string | null };
export type Metrics = {
  window: "7d" | "30d";
  generatedAt: string;
  deploymentFrequency: { total: number; perDay: { date: string; count: number }[] };
  changeFailureRate: { value: number | null; failed: number; total: number };
  mttr: { medianSeconds: number | null; p90Seconds: number | null; resolvedCount: number };
  openIncidents: Incident[];
};

export function useMetrics(repoId: number | null, window: "7d" | "30d") {
  return useQuery({
    queryKey: ["metrics", repoId, window],
    queryFn: () => apiFetch<MetricsResponse>(`/api/repos/${repoId}/metrics?window=${window}`, metricsResponseSchema),
    enabled: repoId !== null,
    refetchInterval: 10000,
    refetchIntervalInBackground: false
  });
}
