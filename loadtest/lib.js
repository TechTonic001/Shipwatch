import crypto from "k6/crypto";
import exec from "k6/execution";
import http from "k6/http";
import { Rate } from "k6/metrics";

export const validErrors = new Rate("valid_event_error_rate");
export const invalidNot401 = new Rate("invalid_signature_not_401_rate");
export const duplicate5xx = new Rate("duplicate_5xx_rate");

export const thresholds = {
  http_req_duration: ["p(99)<1000"],
  valid_event_error_rate: ["rate<0.01"],
  invalid_signature_not_401_rate: ["rate==0"],
  duplicate_5xx_rate: ["rate==0"],
  dropped_iterations: ["count==0"]
};

export function preflight() {
  const target = __ENV.TARGET_URL ?? "";
  const allowlist = (__ENV.ALLOWED_TARGET_URLS ?? "").split(",").map((item) => item.trim()).filter(Boolean);
  const secret = __ENV.GITHUB_WEBHOOK_SECRET ?? "";
  const runId = (__ENV.RUN_ID ?? "").toLowerCase();
  const productionUrl = __ENV.PRODUCTION_URL ?? "";
  if (!target || !allowlist.includes(target)) {
    throw new Error("TARGET_URL must exactly match an entry in ALLOWED_TARGET_URLS.");
  }
  if (!secret) throw new Error("GITHUB_WEBHOOK_SECRET is required.");
  if (!/^[0-9a-f]{8}$/.test(runId)) throw new Error("RUN_ID must be a unique 8-character hexadecimal value.");
  if (!productionUrl) throw new Error("PRODUCTION_URL is required so production targeting can be detected.");
  if (productionUrl === target) {
    console.warn("WARNING: this load test targets the configured production URL.");
    if (__ENV.ALLOW_PRODUCTION !== "true") {
      throw new Error("Set ALLOW_PRODUCTION=true to explicitly permit production load.");
    }
  }
  return { target, runId };
}

function uuidFor(runId, sequence) {
  return `${runId}-0000-4000-8000-${sequence.toString(16).padStart(12, "0")}`;
}

export function sendSignedDelivery(context, sequence, mode) {
  const deliveryId = uuidFor(context.runId, sequence);
  const runNumber = Number.parseInt(context.runId, 16);
  const deploymentId = 200000000000 + runNumber * 10000 + sequence;
  const statusId = deploymentId + 500000000000;
  const repositoryId = 100000000000 + runNumber;
  const payload = {
    action: "created",
    repository: {
      id: repositoryId,
      full_name: `loadtest/${context.runId}`,
      production_environment: "production"
    },
    deployment: {
      id: deploymentId,
      environment: "production",
      sha: "a".repeat(40),
      created_at: new Date().toISOString()
    },
    deployment_status: {
      id: statusId,
      state: "success",
      environment: "production",
      created_at: new Date().toISOString()
    }
  };
  const body = JSON.stringify(payload);
  const digest = crypto.hmac("sha256", __ENV.GITHUB_WEBHOOK_SECRET, body, "hex");
  const invalid = mode === "mixed-invalid" && sequence % 10 === 9;
  const signature = `sha256=${invalid ? (digest[0] === "0" ? "1" : "0") + digest.slice(1) : digest}`;
  const response = http.post(context.target, body, {
    headers: {
      "Content-Type": "application/json",
      "X-GitHub-Delivery": deliveryId,
      "X-GitHub-Event": "deployment_status",
      "X-Hub-Signature-256": signature
    },
    tags: { validity: invalid ? "invalid" : "valid", mode }
  });

  if (invalid) {
    invalidNot401.add(response.status !== 401);
  } else {
    validErrors.add(response.status < 200 || response.status >= 300);
  }
  if (mode === "duplicate-storm") duplicate5xx.add(response.status >= 500);
  return response;
}

export function iterationSequence() {
  return exec.scenario.iterationInTest;
}
