// S3 connection settings, stored in SQLite (the app_config table) rather than
// in environment variables. This lets the configuration be inspected and
// replaced at runtime.
//
// On startup the app checks whether the S3 configuration is present. If any
// required value is missing, `seedDefaultS3Config()` writes hard-coded
// placeholder values into the database. Those placeholders are meant to be
// REPLACED with the real bucket/credentials.

import { getConfigValue, setConfigValue } from "./db.ts";

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  /** Empty for AWS S3; set for R2 / MinIO / other S3-compatible providers. */
  endpoint: string;
}

// Config keys as stored in app_config.
const KEYS = {
  bucket: "s3.bucket",
  region: "s3.region",
  accessKeyId: "s3.accessKeyId",
  secretAccessKey: "s3.secretAccessKey",
  endpoint: "s3.endpoint",
} as const;

// Sentinel placeholder values. If the live config still contains any of these,
// the app is running with default (not-yet-configured) settings.
export const PLACEHOLDER = {
  bucket: "REPLACE_ME_BUCKET",
  region: "us-east-1",
  accessKeyId: "REPLACE_ME_ACCESS_KEY_ID",
  secretAccessKey: "REPLACE_ME_SECRET_ACCESS_KEY",
  endpoint: "",
} as const;

/**
 * Hard-coded default S3 configuration written to the database when none exists.
 * Prefers environment variables when they happen to be set (so existing setups
 * keep working), otherwise falls back to the placeholder values above.
 *
 * REPLACE these with the correct values — either by editing the database
 * (app_config table) or via the settings endpoint.
 */
export function seedDefaultS3Config(): void {
  setConfigValue(KEYS.bucket, process.env.S3_BUCKET || PLACEHOLDER.bucket);
  setConfigValue(KEYS.region, process.env.S3_REGION || PLACEHOLDER.region);
  setConfigValue(
    KEYS.accessKeyId,
    process.env.S3_ACCESS_KEY_ID || PLACEHOLDER.accessKeyId,
  );
  setConfigValue(
    KEYS.secretAccessKey,
    process.env.S3_SECRET_ACCESS_KEY || PLACEHOLDER.secretAccessKey,
  );
  setConfigValue(KEYS.endpoint, process.env.S3_ENDPOINT || PLACEHOLDER.endpoint);
}

/** The required keys whose absence means the config is incomplete. */
const REQUIRED_KEYS = [KEYS.bucket, KEYS.accessKeyId, KEYS.secretAccessKey];

/** True when any required S3 config value is missing from the database. */
export function isS3ConfigMissing(): boolean {
  return REQUIRED_KEYS.some((k) => getConfigValue(k) == null);
}

/** Read the current S3 config from the database. */
export function getS3Config(): S3Config {
  return {
    bucket: getConfigValue(KEYS.bucket) ?? PLACEHOLDER.bucket,
    region: getConfigValue(KEYS.region) ?? PLACEHOLDER.region,
    accessKeyId: getConfigValue(KEYS.accessKeyId) ?? PLACEHOLDER.accessKeyId,
    secretAccessKey:
      getConfigValue(KEYS.secretAccessKey) ?? PLACEHOLDER.secretAccessKey,
    endpoint: getConfigValue(KEYS.endpoint) ?? PLACEHOLDER.endpoint,
  };
}

/** Update one or more S3 config values, then refresh the live client. */
export function updateS3Config(partial: Partial<S3Config>): void {
  if (partial.bucket != null) setConfigValue(KEYS.bucket, partial.bucket);
  if (partial.region != null) setConfigValue(KEYS.region, partial.region);
  if (partial.accessKeyId != null)
    setConfigValue(KEYS.accessKeyId, partial.accessKeyId);
  if (partial.secretAccessKey != null)
    setConfigValue(KEYS.secretAccessKey, partial.secretAccessKey);
  if (partial.endpoint != null) setConfigValue(KEYS.endpoint, partial.endpoint);
}

/**
 * True when the live config still holds placeholder credentials, i.e. the user
 * has not yet replaced the seeded defaults with real values.
 */
export function isUsingPlaceholders(): boolean {
  const cfg = getS3Config();
  return (
    cfg.bucket === PLACEHOLDER.bucket ||
    cfg.accessKeyId === PLACEHOLDER.accessKeyId ||
    cfg.secretAccessKey === PLACEHOLDER.secretAccessKey
  );
}

/**
 * Startup hook: ensure the S3 configuration exists. Seeds hard-coded defaults
 * when missing. Returns whether the running config is still placeholder values.
 */
export function ensureS3Config(): { seeded: boolean; usingPlaceholders: boolean } {
  let seeded = false;
  if (isS3ConfigMissing()) {
    seedDefaultS3Config();
    seeded = true;
  }
  return { seeded, usingPlaceholders: isUsingPlaceholders() };
}
