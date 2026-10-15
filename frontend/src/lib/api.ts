const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3100";

export class ApiError extends Error {
  constructor(public readonly status: number) {
    super(`API request failed: ${status}`);
  }
}

export function getDashboardToken(): string {
  return typeof sessionStorage === "undefined" ? "" : sessionStorage.getItem("shipwatch.dashboardToken") ?? "";
}

export async function apiFetch<T>(path: string): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    headers: { Authorization: `Bearer ${getDashboardToken()}` }
  });
  if (!response.ok) throw new ApiError(response.status);
  return response.json() as Promise<T>;
}
