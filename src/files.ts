// File service: ties S3, hashing and the SQLite metadata store together.
// The key behaviour here is "only rewrite when the content actually changed".

import { deleteObject, getObjectBytes, putObject } from "./s3.ts";
import { contentTypeFor, sha256 } from "./hash.ts";
import { deleteMeta, getMeta, logEdit, upsertMeta } from "./db.ts";

export interface SaveResult {
  key: string;
  /** false when the content was identical and the upload was skipped. */
  written: boolean;
  hash: string;
  size: number;
}

/**
 * Save content to S3, but skip the write entirely when the new content hashes
 * identically to what we last stored. This is the "only rewrite if the file
 * was actually updated" guarantee.
 *
 * @param action "edit" for in-browser HTML/text edits, "upload" for uploads.
 */
export async function saveFile(
  key: string,
  data: Uint8Array | string,
  action: "edit" | "upload",
  contentType?: string,
): Promise<SaveResult> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  const hash = sha256(bytes);
  const size = bytes.byteLength;
  const type = contentType || contentTypeFor(key);

  const existing = getMeta(key);
  if (existing && existing.content_hash === hash) {
    // Identical content — do not touch S3.
    logEdit(key, "skip", hash, size);
    return { key, written: false, hash, size };
  }

  await putObject(key, bytes, type);
  upsertMeta({
    key,
    content_hash: hash,
    size,
    content_type: type,
    updated_at: new Date().toISOString(),
  });
  logEdit(key, action, hash, size);
  return { key, written: true, hash, size };
}

/**
 * Ensure SQLite has an up-to-date hash for a key by reading it from S3.
 * Used when opening a file the app hasn't tracked yet, so the first save can
 * correctly detect a no-op.
 */
export async function syncMetaFromS3(key: string): Promise<string> {
  const bytes = await getObjectBytes(key);
  const hash = sha256(bytes);
  upsertMeta({
    key,
    content_hash: hash,
    size: bytes.byteLength,
    content_type: contentTypeFor(key),
    updated_at: new Date().toISOString(),
  });
  return hash;
}

export async function removeFile(key: string): Promise<void> {
  await deleteObject(key);
  deleteMeta(key);
  logEdit(key, "delete", null, null);
}
