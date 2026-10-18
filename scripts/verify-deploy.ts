import { createHmac, randomUUID } from "node:crypto";

const usage = `Usage: npx tsx scripts/verify-deploy.ts <BACKEND_URL> <FRONTEND_URL> [TOKEN] [WEBHOOK_SECRET]`;

const args = process.argv.slice(2);
const BACKEND_URL = args[0];
const FRONTEND_URL = args[1];
const TOKEN = args[2] ?? process.env.TOKEN ?? "";
const WEBHOOK_SECRET = args[3] ?? process.env.WEBHOOK_SECRET ?? "";

if (!BACKEND_URL || !FRONTEND_URL) {
  console.error(usage);
  process.exit(1);
}

const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
let failCount = 0;

function record(name: string, passed: boolean, detail: string): void {
  checks.push({ name, passed, detail });
  if (!passed) {
    failCount += 1;
  }
}

async function fetchText(input: string, init?: RequestInit): Promise<{ status: number; headers: Headers; body: string }> {
  const response = await fetch(input, init);
  const text = await response.text();
  return { status: response.status, headers: response.headers, body: text };
}

async function ensureBackendHealth(): Promise<void> {
  const health = await fetchText(`${BACKEND_URL}/healthz`);
  const healthy = health.status === 200 && health.body.includes('"status":"ok"');
  record("backend /healthz 200", healthy, `status=${health.status}`);

  const ready = await fetchText(`${BACKEND_URL}/readyz`);
  const readyOk = ready.status === 200 && ready.body.includes('"status":"ready"');
  record("backend /readyz 200", readyOk, `status=${ready.status}`);
}

async function ensureReposAuth(): Promise<void> {
  const unauth = await fetchText(`${BACKEND_URL}/api/repos`, { headers: { Accept: "application/json" } });
  const unauthJson = unauth.status === 401 && unauth.headers.get("content-type")?.includes("application/json");
  record("unauthenticated /api/repos -> 401 JSON", unauthJson, `status=${unauth.status}; content-type=${unauth.headers.get("content-type") ?? "none"}`);

  if (TOKEN) {
    const auth = await fetchText(`${BACKEND_URL}/api/repos`, { headers: { Accept: "application/json", Authorization: `Bearer ${TOKEN}` } });
    const authJson = auth.status === 200 && auth.headers.get("content-type")?.includes("application/json");
    record("authenticated /api/repos -> 200 JSON", authJson, `status=${auth.status}; content-type=${auth.headers.get("content-type") ?? "none"}`);
  } else {
    record("authenticated /api/repos -> 200 JSON", true, "skipped: no TOKEN provided");
  }
}

async function ensureCors(): Promise<void> {
  const allowedOptions = await fetchText(`${BACKEND_URL}/api/repos`, {
    method: "OPTIONS",
    headers: {
      Origin: FRONTEND_URL,
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "Authorization, Content-Type"
    }
  });
  const allowedOrigin = allowedOptions.headers.get("access-control-allow-origin");
  const allowed = allowedOptions.status === 204 && allowedOrigin === FRONTEND_URL;
  record("CORS preflight from FRONTEND_URL -> allowed", allowed, `status=${allowedOptions.status}; ACAO=${allowedOrigin ?? "none"}`);

  const blocked = await fetchText(`${BACKEND_URL}/api/repos`, {
    method: "OPTIONS",
    headers: {
      Origin: "https://evil.example",
      "Access-Control-Request-Method": "GET",
      "Access-Control-Request-Headers": "Authorization, Content-Type"
    }
  });
  const blockedAllowed = blocked.status === 403 || blocked.headers.get("access-control-allow-origin") !== "https://evil.example";
  record("CORS preflight from evil.example -> blocked", blockedAllowed, `status=${blocked.status}; ACAO=${blocked.headers.get("access-control-allow-origin") ?? "none"}`);
}

async function ensureFrontendHtml(): Promise<void> {
  const home = await fetchText(FRONTEND_URL);
  const htmlOk = home.status === 200 && home.headers.get("content-type")?.includes("text/html");
  record("frontend returns 200 HTML", htmlOk, `status=${home.status}; content-type=${home.headers.get("content-type") ?? "none"}`);

  const deep = await fetchText(`${FRONTEND_URL}/anything`);
  const deepOk = deep.status === 200 && deep.headers.get("content-type")?.includes("text/html");
  record("deep link /anything -> 200", deepOk, `status=${deep.status}; content-type=${deep.headers.get("content-type") ?? "none"}`);

  const assetMatches = [...home.body.matchAll(/(?:src|href)="([^"]+\.(?:js|css))"/g)].map((match) => match[1]);
  if (assetMatches.length === 0) {
    record("frontend bundle does not contain localhost or token", false, "no bundled asset match found");
    return;
  }

  const assetUrls = assetMatches.map((match) => new URL(match, FRONTEND_URL).toString());
  const bundleBody = await Promise.all(assetUrls.map((assetUrl) => fetchText(assetUrl)));
  const bundleText = bundleBody.map((asset) => asset.body).join("\n");
  const bundleClean = !bundleText.includes("localhost:") && (!TOKEN || !bundleText.includes(TOKEN));
  record("frontend bundle excludes localhost and token", bundleClean, `assets=${assetUrls.length}`);
}

async function ensureWebhookPing(): Promise<void> {
  if (!WEBHOOK_SECRET) {
    record("signed webhook ping -> 200", true, "skipped: no WEBHOOK_SECRET provided");
    return;
  }

  const payload = JSON.stringify({ zen: "ok" });
  const signature = createHmac("sha256", WEBHOOK_SECRET).update(payload).digest("hex");
  const signed = await fetchText(`${BACKEND_URL}/api/webhooks/github`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Delivery": randomUUID(),
      "X-GitHub-Event": "ping",
      "X-Hub-Signature-256": `sha256=${signature}`
    },
    body: payload
  });
  const webhookOk = signed.status === 200;
  record("signed ping to /api/webhooks/github returns 200", webhookOk, `status=${signed.status}`);
}

async function main(): Promise<void> {
  await ensureBackendHealth();
  await ensureReposAuth();
  await ensureCors();
  await ensureFrontendHtml();
  await ensureWebhookPing();

  for (const check of checks) {
    console.log(`${check.passed ? "PASS" : "FAIL"}: ${check.name}${check.detail ? ` (${check.detail})` : ""}`);
  }

  if (failCount > 0) {
    process.exit(1);
  }
}

void main().catch((error: unknown) => {
  console.error("verify-deploy failed:", error instanceof Error ? error.message : String(error));
  process.exit(1);
});
