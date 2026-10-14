import { z } from "zod";

import { PermanentProcessingError } from "../queue.js";

export const deploymentPayloadSchema = z
  .object({
    deployment: z
      .object({
        id: z.number().int().positive(),
        environment: z.string().optional(),
        sha: z.string().optional(),
        ref: z.string().optional(),
        created_at: z.string().optional(),
        updated_at: z.string().optional(),
        state: z.string().optional()
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

export async function processDeployment(payload: unknown): Promise<void> {
  const parsed = deploymentPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentProcessingError("deployment payload is invalid");
  }

  const deployment = parsed.data.deployment;
  if (deployment.id === undefined) {
    throw new PermanentProcessingError("deployment payload missing id");
  }
}
