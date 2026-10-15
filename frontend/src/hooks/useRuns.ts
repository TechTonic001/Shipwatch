import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

export type Run = { id: number; environment: string; state: string; startedAt: string; updatedAt: string; sha: string | null };
export function useRuns(repoId: number | null) {
  return useQuery({ queryKey: ["runs", repoId], queryFn: () => apiFetch<{ data: Run[] }>(`/api/repos/${repoId}/runs?limit=10`), enabled: repoId !== null, refetchInterval: 10000, refetchIntervalInBackground: false });
}
