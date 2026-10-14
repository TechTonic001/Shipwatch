import { z } from "zod";

import { PermanentProcessingError } from "../queue.js";

export const workflowRunPayloadSchema = z
  .object({
    workflow_run: z
      .object({
        id: z.number().int().positive(),
        run_attempt: z.number().int().nonnegative().optional(),
        name: z.string().optional(),
        head_sha: z.string().optional(),
        head_branch: z.string().optional(),
        event: z.string().optional(),
        status: z.string().optional(),
        conclusion: z.string().nullable().optional(),
        run_started_at: z.string().optional(),
        updated_at: z.string().optional(),
        created_at: z.string().optional(),
        completed_at: z.string().nullable().optional()
      })
      .passthrough()
  })
  .passthrough();

export async function processWorkflowRun(payload: unknown): Promise<void> {
  const parsed = workflowRunPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentProcessingError("workflow_run payload is invalid");
  }

  const workflowRun = parsed.data.workflow_run;
  if (workflowRun.id === undefined) {
    throw new PermanentProcessingError("workflow_run payload missing id");
  }
}
