import { z } from "zod";

import { PermanentProcessingError } from "../queue.js";

const deploymentStatusPayloadSchema = z
  .object({
    deployment_status: z
      .object({
        id: z.number().int().positive(),
        state: z.string().optional(),
        environment: z.string().optional(),
        log_url: z.string().url().optional(),
        updated_at: z.string().optional(),
        created_at: z.string().optional()
      })
      .passthrough(),
    deployment: z
      .object({
        id: z.number().int().positive(),
        environment: z.string().optional(),
        state: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional()
      })
      .passthrough(),
    repository: z
      .object({
        id: z.number().int().positive(),
        full_name: z.string().optional(),
        default_branch: z.string().optional(),
        production_environment: z.string().optional()
      })
      .passthrough()
  })
  .passthrough();

export async function processDeploymentStatus(payload: unknown): Promise<void> {
  const parsed = deploymentStatusPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentProcessingError("deployment_status payload is invalid");
  }

  const status = parsed.data.deployment_status;
  if (status.id === undefined) {
    throw new PermanentProcessingError("deployment_status payload missing id");
  }
}
