import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().url(),
  GITHUB_WEBHOOK_SECRET: z.string().min(1),
  SLACK_WEBHOOK_URL: z.string().url(),
  CRON_SECRET: z.string().min(1),
  NEON_AUTH_BASE_URL: z.string().url().optional(),
  NEON_AUTH_JWKS_URL: z.string().url().optional(),
  NEON_FUNCTION_HELLO_BASE_URL: z.string().url().optional(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("production"),
  PORT: z.coerce.number().int().positive().default(3000)
});

export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
