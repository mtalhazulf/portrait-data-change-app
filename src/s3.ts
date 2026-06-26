// Thin wrapper around Bun's native S3 client.
// Works with AWS S3 out of the box and any S3-compatible provider via a custom endpoint.

import { S3Client, type S3File } from "bun";
import { config } from "./config.ts";

export const s3 = new S3Client({
  bucket: config.s3.bucket,
  region: config.s3.region,
  accessKeyId: config.s3.accessKeyId,
  secretAccessKey: config.s3.secretAccessKey,
  endpoint: config.s3.endpoint,
});

export interface S3Object {
  key: string;
  size: number;
  lastModified?: string;
  eTag?: string;
}

/** List objects in the bucket, optionally under a prefix. */
export async function listObjects(prefix = ""): Promise<S3Object[]> {
  const result = await s3.list({ prefix, maxKeys: 1000 });
  const contents = result?.contents ?? [];
  return contents
    .map((c) => {
      const lm = c.lastModified as unknown;
      return {
        key: c.key,
        size: c.size ?? 0,
        lastModified:
          lm instanceof Date ? lm.toISOString() : (lm as string | undefined),
        eTag: c.eTag,
      };
    })
    .sort((a, b) => a.key.localeCompare(b.key));
}

/** Read an object's raw bytes. */
export async function getObjectBytes(key: string): Promise<Uint8Array> {
  const file: S3File = s3.file(key);
  const buf = await file.arrayBuffer();
  return new Uint8Array(buf);
}

/** Read an object as UTF-8 text. */
export async function getObjectText(key: string): Promise<string> {
  return await s3.file(key).text();
}

/** True if the object exists. */
export async function objectExists(key: string): Promise<boolean> {
  return await s3.exists(key);
}

/** Write/overwrite an object. `contentType` becomes the stored Content-Type. */
export async function putObject(
  key: string,
  data: Uint8Array | string,
  contentType?: string,
): Promise<void> {
  await s3.write(key, data, contentType ? { type: contentType } : undefined);
}

/** Delete an object. */
export async function deleteObject(key: string): Promise<void> {
  await s3.delete(key);
}
