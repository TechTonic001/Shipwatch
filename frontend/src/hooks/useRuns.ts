import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

export function useRuns() {
  return useQuery({ queryKey: ["runs"], queryFn: () => apiFetch<unknown>("/api/runs"), refetchInterval: 10000 });
}
