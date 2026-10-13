import type { RequestHandler } from "express";

export const verifyGithubSignature: RequestHandler = (_req, _res, next) => {
  // TODO: Read the X-Hub-Signature-256 header and require the sha256= prefix.
  // TODO: Compute HMAC-SHA-256 with GITHUB_WEBHOOK_SECRET over the raw Buffer body.
  // TODO: Check lengths before crypto.timingSafeEqual to avoid an exception.
  // TODO: Compare signatures with crypto.timingSafeEqual and return 401 on mismatch.
  next();
};
