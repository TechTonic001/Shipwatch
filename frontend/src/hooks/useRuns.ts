import { useInfiniteQuery } from "@tanstack/react-query";

import { runPageSchema, type RunPage } from "../../../shared/contracts";
import { apiFetch } from "../lib/api";

export type Run = RunPage["data"][number];
export type { RunPage };
export function useRuns(repoId: number | null) {
  return useInfiniteQuery({
    queryKey: ["runs", repoId],
    queryFn: ({ pageParam }) => apiFetch<RunPage>(`/api/repos/${repoId}/runs?limit=10${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`, runPageSchema),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: repoId !== null,
    refetchInterval: 10000,
    refetchIntervalInBackground: false
  });
}
