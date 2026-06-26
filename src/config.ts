// Centralised, validated configuration loaded from the environment.

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable: ${name}. Copy .env.example to .env and fill it in.`,
    );
  }
  return value;
}

export const config = {
  s3: {
    bucket: required("S3_BUCKET"),
    region: process.env.S3_REGION || "us-east-1",
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    // Empty for AWS S3; set for R2 / MinIO / other S3-compatible providers.
    endpoint: process.env.S3_ENDPOINT || undefined,
  },
  port: Number(process.env.PORT || 3000),
  dbPath: process.env.DB_PATH || "./data.sqlite",
};

// File extensions we treat as text-editable in the browser editor.
export const EDITABLE_EXTENSIONS = new Set([
  "html", "htm", "css", "js", "mjs", "cjs", "ts", "json", "txt", "md",
  "xml", "svg", "csv", "yml", "yaml", "tsx", "jsx",
]);

export function extensionOf(key: string): string {
  const base = key.split("/").pop() ?? key;
  const dot = base.lastIndexOf(".");
  return dot >= 0 ? base.slice(dot + 1).toLowerCase() : "";
}

export function isEditable(key: string): boolean {
  return EDITABLE_EXTENSIONS.has(extensionOf(key));
}
