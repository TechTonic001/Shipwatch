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
  NODE_ENV: z.enum(["development", "test", "production"]).catch("development"),
  PORT: z.coerce.number().int().positive().default(4900)
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
