// Content hashing used to decide whether a file actually changed before
// rewriting it to S3.

/** SHA-256 hex digest of the given bytes or string. */
export function sha256(data: Uint8Array | string): string {
  const hasher = new Bun.CryptoHasher("sha256");
  hasher.update(data);
  return hasher.digest("hex");
}

/** Guess a sensible Content-Type from a file extension. */
export function contentTypeFor(key: string): string {
  const base = key.split("/").pop() ?? key;
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
  const map: Record<string, string> = {
    html: "text/html; charset=utf-8",
    htm: "text/html; charset=utf-8",
    css: "text/css; charset=utf-8",
    js: "text/javascript; charset=utf-8",
    mjs: "text/javascript; charset=utf-8",
    json: "application/json; charset=utf-8",
    txt: "text/plain; charset=utf-8",
    md: "text/markdown; charset=utf-8",
    xml: "application/xml; charset=utf-8",
    svg: "image/svg+xml",
    csv: "text/csv; charset=utf-8",
    yml: "application/yaml; charset=utf-8",
    yaml: "application/yaml; charset=utf-8",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    pdf: "application/pdf",
  };
  return map[ext] ?? "application/octet-stream";
}
