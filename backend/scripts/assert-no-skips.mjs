import { readFile } from "node:fs/promises";

const files = process.argv.slice(2);
if (files.length === 0) {
  throw new Error("Usage: node scripts/assert-no-skips.mjs <vitest-json-file> [...]");
}

let skipped = 0;
for (const file of files) {
  const report = JSON.parse(await readFile(file, "utf8"));
  const visit = (value) => {
    if (!value || typeof value !== "object") return;
    if (value.state === "skipped" || value.status === "skipped") skipped += 1;
    for (const child of Object.values(value)) visit(child);
  };
  visit(report);
}

if (skipped > 0) {
  throw new Error(`Vitest reported ${skipped} skipped test result(s).`);
}

console.log("Vitest skip check passed: 0 skipped tests.");
