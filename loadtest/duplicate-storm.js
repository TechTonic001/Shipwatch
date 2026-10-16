import { preflight, thresholds, sendSignedDelivery, iterationSequence } from "./lib.js";

export const options = {
  scenarios: {
    duplicate_storm: {
      executor: "constant-arrival-rate",
      rate: Number(__ENV.RATE ?? 10),
      timeUnit: "1s",
      duration: __ENV.DURATION ?? "60s",
      preAllocatedVUs: 20,
      maxVUs: 100
    }
  },
  thresholds
};

export function setup() {
  return preflight();
}

export default function (context) {
  const uniqueIds = Number(__ENV.UNIQUE_IDS ?? 100);
  const sequence = iterationSequence() % uniqueIds;
  const repeats = Number(__ENV.REPEATS ?? 5);
  for (let index = 0; index < repeats; index += 1) {
    sendSignedDelivery(context, sequence, "duplicate-storm");
  }
}
