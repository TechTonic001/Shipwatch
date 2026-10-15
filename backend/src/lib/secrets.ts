import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

import { env } from "../config/env.js";

const VERSION = "v1";
const IV_BYTES = 12;

function key(encoded = env.ENCRYPTION_KEY): Buffer {
  if (!encoded) throw new Error("ENCRYPTION_KEY is required for secret access");
  return Buffer.from(encoded, "base64");
}

export function encryptSecret(value: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${VERSION}:${iv.toString("base64")}:${cipher.getAuthTag().toString("base64")}:${ciphertext.toString("base64")}`;
}

export function decryptSecret(value: string): string {
  const [version, iv, tag, ciphertext] = value.split(":");
  if (version !== VERSION || !iv || !tag || !ciphertext) throw new Error("Encrypted secret format is invalid");
  const keys = [env.ENCRYPTION_KEY, env.ENCRYPTION_KEY_OLD].filter((item): item is string => Boolean(item));
  let lastError: unknown;
  for (const encodedKey of keys) {
    try {
      const decipher = createDecipheriv("aes-256-gcm", key(encodedKey), Buffer.from(iv, "base64"));
      decipher.setAuthTag(Buffer.from(tag, "base64"));
      return Buffer.concat([decipher.update(Buffer.from(ciphertext, "base64")), decipher.final()]).toString("utf8");
    } catch (error) {
      lastError = error;
    }
  }
  throw new Error("Encrypted secret authentication failed", { cause: lastError });
}

export function isEncryptedSecret(value: string): boolean {
  return value.startsWith(`${VERSION}:`);
}
