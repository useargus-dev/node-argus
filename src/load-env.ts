import fs from "node:fs";
import path from "node:path";

import { parse, populate } from "dotenv";

import { ArgusLockedError } from "./errors.js";
import { fetchBucketEnv } from "./ipc-client.js";
import { clearCachedProxy, setCachedProxy } from "./proxy-state.js";

export type LoadEnvOptions = {
  /** Path to .env file. Default: `.env` in `process.cwd()`. */
  path?: string;
  /**
   * When loading from `.env` only (no bucket credentials), do not override
   * keys already set on `process.env`. Default: `false`.
   *
   * When loading from Argus + `.env`, `.env` always wins over bucket values
   * for duplicate keys (independent of this flag).
   */
  override?: boolean;
  /** IPC response timeout in ms. Default: `130000`. */
  timeoutMs?: number;
  /**
   * If Argus returns IPC `locked` (signed out — not idle app lock), load `.env`
   * instead of throwing. Idle app lock does not block IPC; approval still works.
   * Default: `false` (fail closed).
   */
  fallbackOnLocked?: boolean;
};

export type LoadEnvResult = {
  /** `bucket` when IPC succeeded; `dotenv` when only `.env` was used. */
  source: "bucket" | "dotenv";
  /** Env var names that were set (never includes values). */
  keys: string[];
};

function resolveEnvPath(options?: LoadEnvOptions): string {
  return path.resolve(process.cwd(), options?.path ?? ".env");
}

function readParsedEnv(envPath: string): Record<string, string> {
  if (!fs.existsSync(envPath)) {
    return {};
  }
  return parse(fs.readFileSync(envPath, "utf8"));
}

function applyToProcessEnv(
  parsed: Record<string, string>,
  override: boolean,
): string[] {
  const populated = populate(process.env, parsed, { override });
  return Object.keys(populated);
}

function bucketCredentials(
  parsed: Record<string, string>,
): { bucketId?: string; token?: string } {
  return {
    bucketId: process.env.ARGUS_BUCKET_ID ?? parsed.ARGUS_BUCKET_ID,
    token: process.env.ARGUS_BUCKET_TOKEN ?? parsed.ARGUS_BUCKET_TOKEN,
  };
}

/**
 * Load environment variables into `process.env` (secrets only).
 *
 * Does not enable HTTP proxy or TLS patches. Call `configure()` after
 * `loadEnv()` when the bucket has Argus Proxy enabled.
 *
 * 1. Parse `.env` (does not apply yet).
 * 2. If `ARGUS_BUCKET_ID` and `ARGUS_BUCKET_TOKEN` are set (OS env or `.env`),
 *    fetch secrets from Argus over IPC and apply them.
 * 3. Apply `.env` — duplicate keys override bucket values.
 * 4. Without bucket credentials, apply `.env` only (dotenv-style).
 *
 * Argus idle app lock does not block IPC — only sign-out returns `locked`.
 */
export async function loadEnv(
  options?: LoadEnvOptions,
): Promise<LoadEnvResult> {
  const envPath = resolveEnvPath(options);
  const parsed = readParsedEnv(envPath);
  const { bucketId, token } = bucketCredentials(parsed);
  const fallbackOnLocked = options?.fallbackOnLocked ?? false;
  const dotenvOverride = options?.override ?? false;

  if (!bucketId || !token) {
    clearCachedProxy();
    const keys = applyToProcessEnv(parsed, dotenvOverride);
    return { source: "dotenv", keys };
  }

  try {
    const bucketResult = await fetchBucketEnv({
      bucketId,
      clientToken: token,
      timeoutMs: options?.timeoutMs,
    });

    for (const [key, value] of Object.entries(bucketResult.env)) {
      process.env[key] = value;
    }

    setCachedProxy(bucketResult.proxy);

    const keysFromDotenv = applyToProcessEnv(parsed, true);
    const keys = [...new Set([...Object.keys(bucketResult.env), ...keysFromDotenv])];
    return { source: "bucket", keys };
  } catch (e) {
    clearCachedProxy();
    if (fallbackOnLocked && e instanceof ArgusLockedError) {
      console.warn(`[@useargus/node] ${e.message}; loading .env only`);
      const keys = applyToProcessEnv(parsed, dotenvOverride);
      return { source: "dotenv", keys };
    }
    throw e;
  }
}
