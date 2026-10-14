import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { resolve } from "node:path";

import { sign } from "../tests/helpers/sign.js";

type Options = {
  url: string;
  secret: string;
  file: string;
  count: number;
  duplicates: number;
  concurrency: number;
};

type Result = {
  status: number;
  latencyMs: number;
  duplicate: boolean;
};

function parseOptions(args: string[]): Options {
  const values = new Map<string, string>();
  for (let index = 0; index < args.length; index += 1) {
    const key = args[index];
    const value = args[index + 1];
    if (key?.startsWith("--") && value && !value.startsWith("--")) {
      values.set(key, value);
      index += 1;
    }
  }
  const count = Number(values.get("--count") ?? "1");
  const duplicates = Number(values.get("--duplicates") ?? "1");
  const concurrency = Number(values.get("--concurrency") ?? "1");
  if (!values.get("--url") || !values.get("--secret") || !values.get("--file")) {
    throw new Error("--url, --secret, and --file are required");
  }
  if (![count, duplicates, concurrency].every((value) => Number.isInteger(value) && value > 0)) {
    throw new Error("--count, --duplicates, and --concurrency must be positive integers");
  }
  return {
    url: values.get("--url") as string,
    secret: values.get("--secret") as string,
    file: resolve(values.get("--file") as string),
    count,
    duplicates,
    concurrency
  };
}

async function send(url: string, body: Buffer, secret: string, deliveryId: string): Promise<Result> {
  const started = performance.now();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": deliveryId,
      "x-github-event": "workflow_run",
      "x-hub-signature-256": sign(body, secret)
    },
    body: new Uint8Array(body)
  });
  const result = (await response.json()) as { duplicate?: boolean };
  return {
    status: response.status,
    latencyMs: performance.now() - started,
    duplicate: result.duplicate === true
  };
}

function percentile(values: number[], fraction: number): number {
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))] ?? 0;
}

const options = parseOptions(process.argv.slice(2));
const body = await readFile(options.file);
const deliveries = Array.from({ length: options.count }, () => {
  const deliveryId = randomUUID();
  return Array.from({ length: options.duplicates }, () => ({ body, deliveryId }));
}).flat();
const results: Result[] = [];

for (let index = 0; index < deliveries.length; index += options.concurrency) {
  const batch = deliveries.slice(index, index + options.concurrency);
  results.push(...(await Promise.all(batch.map((delivery) => send(options.url, delivery.body, options.secret, delivery.deliveryId)))));
}

const latencies = results.map((result) => result.latencyMs);
const twoHundred = results.filter((result) => result.status >= 200 && result.status < 300).length;
const fourHundred = results.filter((result) => result.status >= 400 && result.status < 500).length;
const fiveHundred = results.filter((result) => result.status >= 500).length;
const duplicates = results.filter((result) => result.duplicate).length;
process.stdout.write(
  `sent=${results.length} 2xx=${twoHundred} 4xx=${fourHundred} 5xx=${fiveHundred} ` +
  `duplicates_acknowledged=${duplicates} p50=${percentile(latencies, 0.5).toFixed(1)}ms ` +
  `p99=${percentile(latencies, 0.99).toFixed(1)}ms\n`
);
