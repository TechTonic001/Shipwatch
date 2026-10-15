import { z } from "zod";

import { PermanentProcessingError } from "../queue.js";
import { pool } from "../../db/pool.js";
import { evaluateIncidentTransition } from "../incidents.js";

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
  const repository = parsed.data.repository;
  const environment = deployment.environment ?? repository.production_environment ?? "production";
  const createdAt = new Date(deployment.created_at ?? deployment.updated_at ?? new Date().toISOString());
  if (Number.isNaN(createdAt.getTime()) || !repository.full_name) {
    throw new PermanentProcessingError("deployment payload has invalid repository or timestamp");
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO repositories (id, full_name, production_environment)
       VALUES ($1,$2,$3) ON CONFLICT (id) DO UPDATE
       SET full_name = EXCLUDED.full_name, production_environment = EXCLUDED.production_environment`,
      [repository.id, repository.full_name, repository.production_environment ?? "production"]
    );
    const result = await client.query<{
      id: number; repoId: number; repoName: string; environment: string; isProduction: boolean;
      state: string; createdAt: Date; sha: string | null; deploymentUrl: string | null;
    }>(
      `INSERT INTO deployments
       (id, repo_id, environment, is_production, state, sha, ref, deployment_url, created_at, updated_at)
       VALUES ($1,$2,$3,lower(btrim($3)) = lower(btrim($4)),$5,$6,$7,$8,$9,now())
       ON CONFLICT (id) DO UPDATE SET environment=EXCLUDED.environment,
       is_production=EXCLUDED.is_production,state=EXCLUDED.state,sha=COALESCE(EXCLUDED.sha,deployments.sha),
       ref=COALESCE(EXCLUDED.ref,deployments.ref),deployment_url=COALESCE(EXCLUDED.deployment_url,deployments.deployment_url),
       created_at=LEAST(deployments.created_at,EXCLUDED.created_at),updated_at=now()
       RETURNING id, repo_id AS "repoId", (SELECT full_name FROM repositories WHERE id=repo_id) AS "repoName",
       environment,is_production AS "isProduction",state,created_at AS "createdAt",sha,deployment_url AS "deploymentUrl"`,
      [deployment.id, repository.id, environment, repository.production_environment ?? "production",
        deployment.state ?? "pending", deployment.sha ?? null, deployment.ref ?? null, null, createdAt]
    );
    const row = result.rows[0];
    if (row && (row.state === "failure" || row.state === "error" || row.state === "success")) {
      await evaluateIncidentTransition(client, { ...row, createdAt });
    }
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
