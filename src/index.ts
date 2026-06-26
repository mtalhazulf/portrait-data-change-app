// Hono server: routes for browsing, editing, uploading and deleting S3 objects.

import { Hono } from "hono";
import { config, isEditable } from "./config.ts";
import {
  getObjectBytes,
  getObjectText,
  listObjects,
  objectExists,
} from "./s3.ts";
import { getMeta, recentLog } from "./db.ts";
import { removeFile, saveFile, syncMetaFromS3 } from "./files.ts";
import { contentTypeFor } from "./hash.ts";
import {
  editPage,
  listPage,
  listRows,
  logPage,
  toast,
} from "./views.ts";

const app = new Hono();

// --- Pages ---

app.get("/", async (c) => {
  const prefix = c.req.query("prefix") ?? "";
  const objects = await listObjects(prefix);
  return c.html(listPage(objects, prefix));
});

app.get("/edit", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.text("Missing key", 400);
  if (!isEditable(key)) {
    return c.text("This file type is not editable as text. Use View instead.", 400);
  }
  if (!(await objectExists(key))) return c.text("File not found", 404);

  const content = await getObjectText(key);
  // Make sure SQLite knows the current hash so the first save can no-op correctly.
  const meta = getMeta(key);
  const hash = meta?.content_hash ?? (await syncMetaFromS3(key));
  return c.html(editPage(key, content, hash));
});

app.get("/raw", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.text("Missing key", 400);
  if (!(await objectExists(key))) return c.text("File not found", 404);
  const bytes = await getObjectBytes(key);
  return new Response(bytes, {
    headers: { "Content-Type": contentTypeFor(key) },
  });
});

app.get("/log", (c) => {
  return c.html(logPage(recentLog(100)));
});

// --- HTMX / API fragments ---

app.get("/api/list", async (c) => {
  const prefix = c.req.query("prefix") ?? "";
  const objects = await listObjects(prefix);
  return c.html(listRows(objects));
});

// Edit existing file (in-browser textarea -> S3), only rewriting if changed.
app.put("/api/file", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.html(toast("err", "Missing key"), 400);
  try {
    const body = await c.req.parseBody();
    const content = String(body.content ?? "");
    const result = await saveFile(key, content, "edit");
    if (!result.written) {
      return c.html(toast("skip", "No changes detected — file left untouched in S3."));
    }
    return c.html(
      toast("ok", `Saved to S3 (${result.size} B, sha256 ${result.hash.slice(0, 12)}…).`),
    );
  } catch (err) {
    return c.html(toast("err", `Save failed: ${(err as Error).message}`), 500);
  }
});

// Upload any file to a location.
app.post("/api/upload", async (c) => {
  try {
    const body = await c.req.parseBody();
    const file = body.file;
    if (!(file instanceof File)) {
      return c.html(toast("err", "No file provided."), 400);
    }
    let key = String(body.key ?? "").trim();
    // If no key, or key ends with "/", append the uploaded file name.
    if (key === "" || key.endsWith("/")) {
      key = key + file.name;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    const result = await saveFile(
      key,
      bytes,
      "upload",
      file.type || contentTypeFor(key),
    );
    if (!result.written) {
      return c.html(toast("skip", `"${key}" already exists with identical content — skipped.`));
    }
    return c.html(
      toast("ok", `Uploaded "${key}" (${result.size} B). Refresh the list to see it.`),
    );
  } catch (err) {
    return c.html(toast("err", `Upload failed: ${(err as Error).message}`), 500);
  }
});

app.delete("/api/file", async (c) => {
  const key = c.req.query("key");
  if (!key) return c.html(toast("err", "Missing key"), 400);
  try {
    await removeFile(key);
    // Returning empty content removes the row (hx-swap=outerHTML).
    return c.body("");
  } catch (err) {
    return c.html(toast("err", `Delete failed: ${(err as Error).message}`), 500);
  }
});

console.log(
  `S3 File Editor running on http://localhost:${config.port} (bucket: ${config.s3.bucket})`,
);

export default {
  port: config.port,
  fetch: app.fetch,
};
