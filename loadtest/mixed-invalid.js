import { preflight, thresholds, sendSignedDelivery, iterationSequence, recordDroppedIterations } from "./lib.js";

export const options = {
  scenarios: {
    mixed_invalid: {
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
  const sequence = iterationSequence();
  sendSignedDelivery(context, sequence, "mixed-invalid");
  recordDroppedIterations();
}
