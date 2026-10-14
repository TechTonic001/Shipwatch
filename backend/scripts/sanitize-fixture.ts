import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

const secretKey = /(token|secret|password|authorization|credential|signature|cookie|private_key)/i;
const noisyKey = /(avatar_url|gravatar_id|html_url|url)$/i;
const emailPattern = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

function sanitize(value: JsonValue, key = ""): JsonValue {
  if (typeof value === "string") {
    if (secretKey.test(key)) return "[REDACTED]";
    if (emailPattern.test(value)) return "redacted@example.invalid";
    if (noisyKey.test(key)) return "https://example.invalid/redacted";
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => sanitize(item, key));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([childKey, childValue]) => [childKey, sanitize(childValue, childKey)])
    );
  }
  return value;
}

function option(name: string): string {
  const index = process.argv.indexOf(name);
  const value = process.argv[index + 1];
  if (!value || value.startsWith("--")) throw new Error(`${name} is required`);
  return value;
}

const input = resolve(option("--input"));
const output = resolve(option("--output"));
const source: unknown = JSON.parse(await readFile(input, "utf8"));
if (source === null || typeof source !== "object") throw new Error("Fixture must contain a JSON object");
await writeFile(output, `${JSON.stringify(sanitize(source as JsonValue), null, 2)}\n`, "utf8");
process.stdout.write(`Sanitized fixture written to ${output}\n`);
