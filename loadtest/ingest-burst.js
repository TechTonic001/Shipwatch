import { preflight, thresholds, sendSignedDelivery, iterationSequence } from "./lib.js";

export const options = {
  scenarios: {
    burst_ingest: {
      executor: "ramping-arrival-rate",
      startRate: 10,
      timeUnit: "1s",
      preAllocatedVUs: 40,
      maxVUs: 200,
      stages: [
        { target: 50, duration: "30s" },
        { target: 100, duration: "30s" }
      ]
    }
  },
  thresholds
};

export function setup() {
  return preflight();
}

export default function (context) {
  const sequence = iterationSequence();
  sendSignedDelivery(context, sequence, "burst");
}
