import { useInfiniteQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

export type Run = { id: number; environment: string; state: string; startedAt: string; updatedAt: string; sha: string | null };
export type RunPage = { data: Run[]; nextCursor: string | null };
export function useRuns(repoId: number | null) {
  return useInfiniteQuery({
    queryKey: ["runs", repoId],
    queryFn: ({ pageParam }) => apiFetch<RunPage>(`/api/repos/${repoId}/runs?limit=10${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: repoId !== null,
    refetchInterval: 10000,
    refetchIntervalInBackground: false
  });
}
