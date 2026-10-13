const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:3100";

export async function apiFetch<T>(path: string): Promise<T> {
  // TODO: Add authenticated, typed API error handling and request tracing.
  const response = await fetch(`${apiUrl}${path}`);
  if (!response.ok) throw new Error(`API request failed: ${response.status}`);
  return response.json() as Promise<T>;
}
