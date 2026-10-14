import { z } from "zod";

import { pool } from "../../db/pool.js";
import { PermanentProcessingError } from "../queue.js";
import { evaluateIncidentTransition } from "../incidents.js";

export const deploymentStatusPayloadSchema = z
  .object({
    deployment_status: z.object({
      id: z.number().int().positive(),
      state: z.string(),
      environment: z.string().optional(),
      created_at: z.string().datetime().optional(),
      updated_at: z.string().datetime().optional()
    }),
    deployment: z.object({
      id: z.number().int().positive(),
      environment: z.string().optional(),
      sha: z.string().optional(),
      ref: z.string().optional(),
      created_at: z.string().datetime().optional(),
      updated_at: z.string().datetime().optional(),
      deploy_url: z.string().url().optional()
    }),
    repository: z.object({
      id: z.number().int(),
      full_name: z.string().min(1),
      production_environment: z.string().optional()
    })
  })
  .passthrough();

export async function processDeploymentStatus(payload: unknown): Promise<void> {
  const parsed = deploymentStatusPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    throw new PermanentProcessingError("deployment_status payload is invalid");
  }

  const { deployment_status: status, deployment, repository } = parsed.data;
  const environment = status.environment ?? deployment.environment ?? repository.production_environment ?? "production";
  const createdAt = new Date(status.created_at ?? deployment.created_at ?? status.updated_at ?? deployment.updated_at ?? new Date().toISOString());
  if (Number.isNaN(createdAt.getTime())) {
    throw new PermanentProcessingError("deployment_status payload has invalid timestamp");
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO repositories (id, full_name, production_environment)
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO UPDATE
         SET full_name = EXCLUDED.full_name,
             production_environment = EXCLUDED.production_environment`,
      [repository.id, repository.full_name, repository.production_environment ?? "production"]
    );
    const deploymentResult = await client.query<{
      id: number;
      repoId: number;
      repoName: string;
      environment: string;
      isProduction: boolean;
      state: string;
      createdAt: Date;
      sha: string | null;
      deploymentUrl: string | null;
    }>(
      `INSERT INTO deployments
        (id, repo_id, environment, is_production, state, sha, ref, deployment_url, created_at, updated_at)
       VALUES ($1, $2, $3, lower(btrim($3)) = lower(btrim($4)), $5, $6, $7, $8, $9, now())
       ON CONFLICT (id) DO UPDATE
         SET environment = EXCLUDED.environment,
             is_production = EXCLUDED.is_production,
             state = EXCLUDED.state,
             sha = COALESCE(EXCLUDED.sha, deployments.sha),
             ref = COALESCE(EXCLUDED.ref, deployments.ref),
             deployment_url = COALESCE(EXCLUDED.deployment_url, deployments.deployment_url),
             created_at = LEAST(deployments.created_at, EXCLUDED.created_at),
             updated_at = now()
       RETURNING id, repo_id AS "repoId",
         (SELECT full_name FROM repositories WHERE id = repo_id) AS "repoName",
         environment, is_production AS "isProduction", state,
         created_at AS "createdAt", sha, deployment_url AS "deploymentUrl"`,
      [
        deployment.id,
        repository.id,
        environment,
        repository.production_environment ?? "production",
        status.state,
        deployment.sha ?? null,
        deployment.ref ?? null,
        deployment.deploy_url ?? null,
        new Date(deployment.created_at ?? createdAt.toISOString())
      ]
    );
    const domainDeployment = deploymentResult.rows[0];
    await client.query(
      `INSERT INTO deployment_statuses (id, deployment_id, state, created_at, payload)
       VALUES ($1, $2, $3, $4, $5::jsonb)
       ON CONFLICT (id) DO NOTHING`,
      [status.id, deployment.id, status.state, createdAt, JSON.stringify(parsed.data)]
    );
    await evaluateIncidentTransition(client, {
      ...domainDeployment,
      createdAt,
      state: status.state,
      isProduction: domainDeployment.isProduction
    });
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}
