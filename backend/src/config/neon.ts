import { env } from "./env.js";

export const neonServices = {
  auth: {
    baseUrl: env.NEON_AUTH_BASE_URL,
    jwksUrl: env.NEON_AUTH_JWKS_URL
  },
  functions: {
    helloBaseUrl: env.NEON_FUNCTION_HELLO_BASE_URL
  }
} as const;
