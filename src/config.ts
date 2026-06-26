// Bootstrap configuration. Only the bits needed to start the process and open
// the database live here — the S3 connection settings are stored in SQLite and
// managed in ./settings.ts (so they can be edited at runtime, not just via env).

export const config = {
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
