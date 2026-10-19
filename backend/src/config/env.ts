import "dotenv/config";

import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  SLACK_WEBHOOK_URL: z.string().url(),
  CRON_SECRET: z.string().min(1).optional(),
  OPERATOR_SLACK_WEBHOOK_URL: z.string().url().optional(),
  OPERATOR_ALERT_BACKLOG_THRESHOLD: z.coerce.number().int().min(1).default(10),
  NEON_AUTH_BASE_URL: z.string().url().optional(),
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  NEON_FUNCTION_HELLO_BASE_URL: z.string().url().optional(),
  DASHBOARD_READ_TOKEN: z.string().min(1).default("test-dashboard-token"),
  FRONTEND_ORIGIN: z.string().url().default("http://localhost:5173"),
  BUILD_SHA: z.string().min(1).default("unknown"),
  GITHUB_RECONCILE_TOKEN: z.string().min(1).optional(),
  GITHUB_API_URL: z.string().url().default("https://api.github.com"),
  ENCRYPTION_KEY: z.string().refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32, "ENCRYPTION_KEY must be base64 for exactly 32 bytes").optional(),
  ENCRYPTION_KEY_OLD: z.string().refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32, "ENCRYPTION_KEY_OLD must be base64 for exactly 32 bytes").optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).catch("development"),
  PORT: z.coerce.number().int().positive().default(4900)
}).superRefine((value, context) => {
  if (value.NODE_ENV === "production" && !value.ENCRYPTION_KEY) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["ENCRYPTION_KEY"], message: "ENCRYPTION_KEY is required in production" });
  }
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
