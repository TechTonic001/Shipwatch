import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

export function useMetrics() {
  return useQuery({ queryKey: ["metrics"], queryFn: () => apiFetch<unknown>("/api/metrics"), refetchInterval: 10000 });
}
