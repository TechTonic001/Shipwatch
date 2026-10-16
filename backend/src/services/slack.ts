export type SlackResult =
  | { ok: true }
  | { ok: false; retryable: boolean; retryAfterMs?: number; reason: string };

const MAX_RETRY_AFTER_MS = 15 * 60 * 1000;

function safeRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) return undefined;
  return Math.min(MAX_RETRY_AFTER_MS, Math.max(1000, Math.round(seconds * 1000)));
}

export async function sendSlackMessage(
  url: string,
  message: string,
  options: { signal?: AbortSignal } = {}
): Promise<SlackResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, retryable: false, reason: "invalid webhook URL" };
  }
  const localTestServer =
    process.env.NODE_ENV === "test" &&
    parsed.protocol === "http:" &&
    (parsed.hostname === "127.0.0.1" || parsed.hostname === "::1");
  if (!localTestServer && (parsed.protocol !== "https:" || parsed.hostname !== "hooks.slack.com")) {
    return { ok: false, retryable: false, reason: "webhook URL is not an allowed Slack host" };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  const signal = options.signal
    ? AbortSignal.any([options.signal, controller.signal])
    : controller.signal;
  try {
    const response = await fetch(parsed, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: message }),
      signal
    });
    if (response.status === 200) return { ok: true };
    if (response.status === 429) {
      return {
        ok: false,
        retryable: true,
        retryAfterMs: safeRetryAfter(response.headers.get("retry-after")),
        reason: "Slack rate limited the webhook"
      };
    }
    if (response.status >= 500) {
      return { ok: false, retryable: true, reason: `Slack returned ${response.status}` };
    }
    return { ok: false, retryable: false, reason: `Slack returned ${response.status}` };
  } catch (error) {
    return {
      ok: false,
      retryable: true,
      reason: error instanceof Error && error.name === "AbortError" ? "Slack request timed out" : "Slack request failed"
    };
  } finally {
    clearTimeout(timeout);
  }
}

export function escapeSlackText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function formatSlackMessage(
  kind: string,
  payload: { repo: string; environment: string; sha?: string; deploymentUrl?: string; durationSeconds?: number }
): string {
  const repo = escapeSlackText(payload.repo);
  const environment = escapeSlackText(payload.environment);
  const sha = escapeSlackText(payload.sha ?? "unknown");
  const link = payload.deploymentUrl ? ` ${escapeSlackText(payload.deploymentUrl)}` : "";
  const duration = payload.durationSeconds === undefined
    ? ""
    : ` recovered after ${Math.round(payload.durationSeconds / 60)} min`;
  return `${kind === "incident_resolved" ? "Recovered" : "Incident"}: ${repo} ${environment} ${sha}${duration}${link}`;
}
