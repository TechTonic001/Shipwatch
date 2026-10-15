import "dotenv/config";

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  SLACK_WEBHOOK_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
  NEON_AUTH_BASE_URL: z.string().url().optional(),
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  NEON_FUNCTION_HELLO_BASE_URL: z.string().url().optional(),
  DASHBOARD_READ_TOKEN: z.string().min(1).default("test-dashboard-token"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  BUILD_SHA: z.string().min(1).default("unknown"),
  GITHUB_RECONCILE_TOKEN: z.string().min(1).optional(),
  ENCRYPTION_KEY: z.string().refine((value) => {
    try {
      return Buffer.from(value, "base64").length === 32;
    } catch {
      return false;
    }
  }, "ENCRYPTION_KEY must be base64 for exactly 32 bytes").optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).catch("development"),
  PORT: z.coerce.number().int().positive().default(4900)
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
