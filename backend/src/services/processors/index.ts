import { PermanentProcessingError } from "../queue.js";
import type { QueueDelivery } from "../queue.js";
import { processDeployment } from "./deployment.js";
import { processDeploymentStatus } from "./deploymentStatus.js";
import { processWorkflowRun } from "./workflowRun.js";

export type ProcessorOutcome = "processed" | "failed" | "dead" | "ignored";

export async function processQueuedDelivery(row: QueueDelivery): Promise<ProcessorOutcome> {
  try {
    switch (row.eventType) {
      case "workflow_run":
        await processWorkflowRun(row.payload);
        return "processed";
      case "deployment":
        await processDeployment(row.payload);
        return "processed";
      case "deployment_status":
        await processDeploymentStatus(row.payload);
        return "processed";
      default:
        return "ignored";
    }
  } catch (error) {
    if (error instanceof PermanentProcessingError) {
      return "dead";
    }

    return "failed";
  }
}
