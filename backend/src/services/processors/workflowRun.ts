import { z } from "zod";

import { PermanentProcessingError } from "../queue.js";
import { pool } from "../../db/pool.js";

export const workflowRunPayloadSchema = z
  .object({
    repository: z.object({ id: z.number().int().positive(), full_name: z.string().min(1) }).passthrough(),
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
  const repository = parsed.data.repository;
  if (!repository || typeof repository !== "object" || !("id" in repository) || !("full_name" in repository)) {
    throw new PermanentProcessingError("workflow_run payload missing repository");
  }
  const repo = repository as { id: number; full_name: string };
  await pool.query(
    `INSERT INTO repositories (id, full_name)
     VALUES ($1, $2)
     ON CONFLICT (id) DO UPDATE SET full_name = EXCLUDED.full_name`,
    [repo.id, repo.full_name]
  );
  await pool.query(
    `INSERT INTO workflow_runs
      (id, repo_id, name, head_sha, head_branch, event, status, conclusion, run_started_at, updated_at, created_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT (id) DO UPDATE SET
       status = EXCLUDED.status, conclusion = EXCLUDED.conclusion,
       updated_at = EXCLUDED.updated_at, run_started_at = COALESCE(EXCLUDED.run_started_at, workflow_runs.run_started_at)`,
    [
      workflowRun.id, repo.id, workflowRun.name ?? null, workflowRun.head_sha ?? null,
      workflowRun.head_branch ?? null, workflowRun.event ?? null, workflowRun.status ?? null,
      workflowRun.conclusion ?? null, workflowRun.run_started_at ? new Date(workflowRun.run_started_at) : null,
      workflowRun.updated_at ? new Date(workflowRun.updated_at) : null,
      new Date(workflowRun.created_at ?? workflowRun.run_started_at ?? new Date().toISOString())
    ]
  );
}
