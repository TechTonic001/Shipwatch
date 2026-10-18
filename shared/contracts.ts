import { z } from "zod";

export const versionResponseSchema = z.object({
  sha: z.string().min(1),
  env: z.string().min(1)
});

export const repositorySchema = z.object({
  id: z.number().int().positive(),
  fullName: z.string().min(1),
  productionEnvironment: z.string().min(1)
});
export const repositoryListSchema = z.array(repositorySchema);

export const metricsResponseSchema = z.object({
  window: z.enum(["7d", "30d"]),
  generatedAt: z.string().datetime(),
  deploymentFrequency: z.object({
    total: z.number().nonnegative(),
    perDay: z.array(z.object({
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      count: z.number().int().nonnegative()
    }))
  }),
  changeFailureRate: z.object({
    value: z.number().nullable(),
    failed: z.number().int().nonnegative(),
    total: z.number().int().nonnegative()
  }),
  mttr: z.object({
    medianSeconds: z.number().nullable(),
    p90Seconds: z.number().nullable(),
    resolvedCount: z.number().int().nonnegative()
  }),
  openIncidents: z.array(z.object({
    id: z.string().min(1),
    environment: z.string().min(1),
    openedAt: z.string().datetime(),
    ageSeconds: z.number().int().nonnegative()
  }))
});

export const runSchema = z.object({
  id: z.number().int().positive(),
  environment: z.string().min(1),
  state: z.string().min(1),
  startedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  sha: z.string().nullable(),
  deploymentUrl: z.string().nullable().optional()
});
export const runPageSchema = z.object({
  data: z.array(runSchema),
  nextCursor: z.string().nullable()
});

export const incidentSchema = z.object({
  id: z.string().min(1),
  environment: z.string().min(1),
  status: z.enum(["open", "resolved"]),
  openedAt: z.string().datetime(),
  resolvedAt: z.string().nullable(),
  ageSeconds: z.number().nullable()
});
export const incidentPageSchema = z.object({
  data: z.array(incidentSchema),
  nextCursor: z.string().nullable()
});

export type VersionResponse = z.infer<typeof versionResponseSchema>;
export type Repository = z.infer<typeof repositorySchema>;
export type MetricsResponse = z.infer<typeof metricsResponseSchema>;
export type Run = z.infer<typeof runSchema>;
export type RunPage = z.infer<typeof runPageSchema>;
export type Incident = z.infer<typeof incidentSchema>;
export type IncidentPage = z.infer<typeof incidentPageSchema>;
