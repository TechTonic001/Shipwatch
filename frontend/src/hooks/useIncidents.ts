import { useQuery } from "@tanstack/react-query";

import { apiFetch } from "../lib/api";

export function useIncidents() {
  return useQuery({ queryKey: ["incidents"], queryFn: () => apiFetch<unknown>("/api/incidents"), refetchInterval: 10000 });
}
