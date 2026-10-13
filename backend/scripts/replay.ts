import { readdir, readFile } from "node:fs/promises";
import { basename, resolve } from "node:path";

type Options = {
  baseUrl: string;
  directory: string;
  rate: number;
  duplicates: number;
  shuffle: boolean;
};

function parseOptions(args: string[]): Options {
  const options: Options = {
    baseUrl: "http://localhost:3100",
    directory: resolve("tests/fixtures"),
    rate: 1,
    duplicates: 1,
    shuffle: false
  };

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index];
    const next = args[index + 1];
    if (value === "--base-url" && next) options.baseUrl = next.replace(/\/$/, "");
    else if (value === "--fixtures" && next) options.directory = resolve(next);
    else if (value === "--rate" && next) options.rate = Number(next);
    else if (value === "--duplicates" && next) options.duplicates = Number(next);
    else if (value === "--shuffle") options.shuffle = true;
    else if (value === "--help") {
      console.log("Usage: npm run replay -- [--base-url URL] [--fixtures DIR] [--rate N] [--duplicates N] [--shuffle]");
      process.exit(0);
    }
  }

  if (!Number.isFinite(options.rate) || options.rate <= 0) throw new Error("--rate must be greater than 0");
  if (!Number.isInteger(options.duplicates) || options.duplicates <= 0) throw new Error("--duplicates must be a positive integer");
  return options;
}

function shuffle<T>(items: T[]): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [items[index], items[target]] = [items[target], items[index]];
  }
  return items;
}

const options = parseOptions(process.argv.slice(2));
const files = (await readdir(options.directory)).filter((file) => file.endsWith(".json"));
const fixtures = options.shuffle ? shuffle(files) : files;
const deliveries = fixtures.flatMap((file) => Array.from({ length: options.duplicates }, () => file));
const delayMs = 1000 / options.rate;

for (const file of deliveries) {
  const payload = await readFile(resolve(options.directory, file), "utf8");
  const response = await fetch(`${options.baseUrl}/api/webhooks/github`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-delivery": `${basename(file, ".json")}-${Date.now()}`,
      "x-github-event": "workflow_run"
    },
    body: payload
  });
  if (!response.ok) throw new Error(`Replay failed for ${file}: ${response.status}`);
  console.log(`${file}: ${response.status}`);
  await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
}
