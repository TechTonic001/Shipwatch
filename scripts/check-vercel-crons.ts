import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type CronConfig = { crons?: unknown };
type CronEntry = { schedule?: unknown; path?: unknown };

const ignoredDirectories = new Set([".git", ".vercel", "dist", "node_modules"]);
const rootDirectory = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function validField(field: string, minimum: number, maximum: number): boolean {
  if (!field) return false;
  return field.split(",").every((part) => {
    if (!part) return false;
    const [base, step, extra] = part.split("/");
    if (extra !== undefined || !base) return false;
    if (step !== undefined && (!/^\d+$/.test(step) || Number(step) < 1)) return false;
    if (base === "*") return true;
    const range = base.split("-");
    if (range.length > 2 || range.some((value) => !/^\d+$/.test(value))) return false;
    const values = range.map(Number);
    return values.every((value) => value >= minimum && value <= maximum) &&
      (values.length === 1 || (values[0] ?? 0) <= (values[1] ?? 0));
  });
}

function hasOneFixedValue(field: string, minimum: number, maximum: number): boolean {
  return /^\d+$/.test(field) && Number(field) >= minimum && Number(field) <= maximum;
}

export function scheduleRunsAtMostDaily(schedule: string): boolean {
  const fields = schedule.trim().split(/\s+/);
  if (fields.length !== 5) return false;
  const [minute, hour, dayOfMonth, month, dayOfWeek] = fields;
  if (!minute || !hour || !dayOfMonth || !month || !dayOfWeek) return false;

  const fieldsAreValid = validField(minute, 0, 59) &&
    validField(hour, 0, 23) &&
    validField(dayOfMonth, 1, 31) &&
    validField(month, 1, 12) &&
    validField(dayOfWeek, 0, 7);
  return fieldsAreValid && hasOneFixedValue(minute, 0, 59) && hasOneFixedValue(hour, 0, 23);
}

async function findVercelConfigs(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries
    .filter((entry) => entry.isDirectory() && !ignoredDirectories.has(entry.name))
    .map((entry) => findVercelConfigs(join(directory, entry.name))));
  return [
    ...entries.filter((entry) => entry.isFile() && entry.name === "vercel.json").map((entry) => join(directory, entry.name)),
    ...nested.flat()
  ];
}

async function main(): Promise<void> {
  const files = await findVercelConfigs(rootDirectory);
  let failed = false;
  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readFile(file, "utf8")) as unknown;
    } catch (error) {
      process.stderr.write(`FAIL ${file}: ${error instanceof Error ? error.message : String(error)}\n`);
      failed = true;
      continue;
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      process.stderr.write(`FAIL ${file}: expected a JSON object\n`);
      failed = true;
      continue;
    }
    const config = parsed as CronConfig;

    if (config.crons === undefined) {
      process.stdout.write(`PASS ${file}: no cron entries\n`);
      continue;
    }
    if (!Array.isArray(config.crons)) {
      process.stderr.write(`FAIL ${file}: crons must be an array\n`);
      failed = true;
      continue;
    }

    for (const [index, rawEntry] of config.crons.entries()) {
      if (typeof rawEntry !== "object" || rawEntry === null || Array.isArray(rawEntry)) {
        process.stderr.write(`FAIL ${file} cron[${index}]: expected an object\n`);
        failed = true;
        continue;
      }
      const entry = rawEntry as CronEntry;
      if (typeof entry.schedule !== "string" || !scheduleRunsAtMostDaily(entry.schedule)) {
        process.stderr.write(`FAIL ${file} cron[${index}] ${String(entry.path)}: invalid or more frequent than daily (${String(entry.schedule)})\n`);
        failed = true;
        continue;
      }
      process.stdout.write(`PASS ${file} cron[${index}] ${String(entry.path)}: ${entry.schedule}\n`);
    }
  }

  if (files.length === 0) {
    process.stderr.write("FAIL no vercel.json files found\n");
    failed = true;
  }
  if (failed) process.exitCode = 1;
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : "";
if (import.meta.url === invokedPath) {
  void main().catch((error: unknown) => {
    process.stderr.write(`Cron policy check failed: ${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
