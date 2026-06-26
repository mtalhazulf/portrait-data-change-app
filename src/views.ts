// HTML views rendered server-side with HTMX for interactivity.

import { html, raw } from "hono/html";
import type { HtmlEscapedString } from "hono/utils/html";
import type { S3Object } from "./s3.ts";
import { extensionOf, isEditable } from "./config.ts";

function fmtSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function layout(
  title: string,
  body: HtmlEscapedString | Promise<HtmlEscapedString>,
): HtmlEscapedString | Promise<HtmlEscapedString> {
  return html`<!doctype html>
    <html lang="en">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
        <script src="https://unpkg.com/htmx.org@2.0.4"></script>
        <style>
          :root { --bg:#0f172a; --panel:#1e293b; --border:#334155; --text:#e2e8f0; --muted:#94a3b8; --accent:#38bdf8; --ok:#4ade80; --warn:#fbbf24; --danger:#f87171; }
          * { box-sizing: border-box; }
          body { margin:0; font-family: ui-sans-serif, system-ui, -apple-system, sans-serif; background:var(--bg); color:var(--text); }
          header { padding:1rem 1.5rem; border-bottom:1px solid var(--border); display:flex; align-items:center; gap:1rem; }
          header h1 { font-size:1.1rem; margin:0; }
          header .bucket { color:var(--muted); font-size:.85rem; }
          main { padding:1.5rem; max-width:1100px; margin:0 auto; }
          a { color:var(--accent); text-decoration:none; }
          a:hover { text-decoration:underline; }
          table { width:100%; border-collapse:collapse; }
          th, td { text-align:left; padding:.5rem .75rem; border-bottom:1px solid var(--border); font-size:.9rem; }
          th { color:var(--muted); font-weight:600; }
          tr:hover td { background:rgba(148,163,184,.06); }
          .btn { display:inline-block; padding:.4rem .8rem; border-radius:.4rem; border:1px solid var(--border); background:var(--panel); color:var(--text); cursor:pointer; font-size:.85rem; }
          .btn:hover { border-color:var(--accent); }
          .btn-danger { color:var(--danger); }
          .btn-primary { background:var(--accent); color:#0f172a; border-color:var(--accent); font-weight:600; }
          .panel { background:var(--panel); border:1px solid var(--border); border-radius:.6rem; padding:1.25rem; margin-bottom:1.25rem; }
          .panel h2 { margin:0 0 1rem; font-size:1rem; }
          input[type=text], textarea { width:100%; padding:.55rem .7rem; background:var(--bg); border:1px solid var(--border); border-radius:.4rem; color:var(--text); font-family:inherit; font-size:.9rem; }
          textarea { font-family: ui-monospace, monospace; min-height:55vh; resize:vertical; line-height:1.5; }
          label { display:block; font-size:.8rem; color:var(--muted); margin:.75rem 0 .3rem; }
          .row { display:flex; gap:.6rem; align-items:center; flex-wrap:wrap; }
          .tag { font-size:.7rem; padding:.1rem .4rem; border-radius:.3rem; background:var(--border); color:var(--muted); text-transform:uppercase; }
          .toast { padding:.6rem .9rem; border-radius:.4rem; font-size:.9rem; margin-bottom:1rem; }
          .toast-ok { background:rgba(74,222,128,.12); border:1px solid var(--ok); color:var(--ok); }
          .toast-skip { background:rgba(251,191,36,.12); border:1px solid var(--warn); color:var(--warn); }
          .toast-err { background:rgba(248,113,113,.12); border:1px solid var(--danger); color:var(--danger); }
          .muted { color:var(--muted); font-size:.85rem; }
          .toolbar { display:flex; justify-content:space-between; align-items:center; gap:1rem; margin-bottom:1rem; flex-wrap:wrap; }
        </style>
      </head>
      <body>
        <header>
          <h1>🗂️ S3 File Editor</h1>
          <span class="bucket">Hono · HTMX · SQLite</span>
        </header>
        <main>${body}</main>
      </body>
    </html>`;
}

export function fileRow(o: S3Object): HtmlEscapedString | Promise<HtmlEscapedString> {
  const ext = extensionOf(o.key);
  const editable = isEditable(o.key);
  const enc = encodeURIComponent(o.key);
  return html`
    <tr id="row-${enc}">
      <td>
        <span class="tag">${ext || "—"}</span>
        ${editable
          ? html`<a href="/edit?key=${enc}">${o.key}</a>`
          : html`<span>${o.key}</span>`}
      </td>
      <td class="muted">${fmtSize(o.size)}</td>
      <td class="muted">${o.lastModified ? o.lastModified.replace("T", " ").slice(0, 19) : ""}</td>
      <td class="row">
        <a class="btn" href="/raw?key=${enc}" target="_blank">View</a>
        ${editable ? html`<a class="btn" href="/edit?key=${enc}">Edit</a>` : ""}
        <button
          class="btn btn-danger"
          hx-delete="/api/file?key=${enc}"
          hx-confirm="Delete ${o.key}? This removes it from the bucket."
          hx-target="#row-${enc}"
          hx-swap="outerHTML"
        >
          Delete
        </button>
      </td>
    </tr>`;
}

export function listPage(
  objects: S3Object[],
  prefix: string,
): HtmlEscapedString | Promise<HtmlEscapedString> {
  return layout(
    "S3 File Editor",
    html`
      <div class="panel">
        <h2>Upload a file</h2>
        <form
          hx-post="/api/upload"
          hx-encoding="multipart/form-data"
          hx-target="#upload-result"
          hx-swap="innerHTML"
          hx-on::after-request="if(event.detail.successful) this.reset()"
        >
          <label>Destination key (folder/path, optional). The file name is appended if the key ends with "/".</label>
          <input type="text" name="key" placeholder="e.g. portraits/ or assets/page.html" />
          <label>File</label>
          <input type="file" name="file" required />
          <div class="row" style="margin-top:1rem">
            <button class="btn btn-primary" type="submit">Upload</button>
            <span id="upload-result" class="muted"></span>
          </div>
        </form>
      </div>

      <div class="toolbar">
        <h2 style="margin:0">Files</h2>
        <form hx-get="/api/list" hx-target="#file-table" hx-swap="innerHTML" class="row">
          <input type="text" name="prefix" placeholder="Filter by prefix…" value="${prefix}" style="width:240px" />
          <button class="btn" type="submit">Filter</button>
          <a class="btn" href="/">Reset</a>
          <a class="btn" href="/log">History</a>
        </form>
      </div>

      <div class="panel" style="padding:0">
        <table>
          <thead>
            <tr><th>Key</th><th>Size</th><th>Modified</th><th>Actions</th></tr>
          </thead>
          <tbody id="file-table">${raw(listRows(objects))}</tbody>
        </table>
      </div>
    `,
  );
}

// Rendered both for full page and for the htmx-swapped tbody.
export function listRows(objects: S3Object[]): string {
  if (objects.length === 0) {
    return `<tr><td colspan="4" class="muted" style="padding:1.25rem">No files found.</td></tr>`;
  }
  return objects.map((o) => (fileRow(o) as HtmlEscapedString).toString()).join("");
}

export function editPage(
  key: string,
  content: string,
  currentHash: string,
): HtmlEscapedString | Promise<HtmlEscapedString> {
  const enc = encodeURIComponent(key);
  return layout(
    `Edit · ${key}`,
    html`
      <div class="toolbar">
        <div>
          <a href="/">← All files</a>
          <h2 style="margin:.3rem 0 0">${key}</h2>
        </div>
        <a class="btn" href="/raw?key=${enc}" target="_blank">View raw</a>
      </div>

      <div id="save-result"></div>

      <form
        hx-put="/api/file?key=${enc}"
        hx-target="#save-result"
        hx-swap="innerHTML"
      >
        <textarea name="content" spellcheck="false">${content}</textarea>
        <input type="hidden" name="baseHash" value="${currentHash}" />
        <div class="row" style="margin-top:1rem">
          <button class="btn btn-primary" type="submit">Save to S3</button>
          <span class="muted">Saving is skipped automatically if nothing changed.</span>
        </div>
      </form>
    `,
  );
}

export function toast(kind: "ok" | "skip" | "err", message: string): string {
  const cls = kind === "ok" ? "toast-ok" : kind === "skip" ? "toast-skip" : "toast-err";
  return `<div class="toast ${cls}">${escapeHtml(message)}</div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function logPage(
  rows: { action: string; key: string; size: number | null; at: string }[],
): HtmlEscapedString | Promise<HtmlEscapedString> {
  return layout(
    "Edit history",
    html`
      <div class="toolbar">
        <h2 style="margin:0">Edit history</h2>
        <a class="btn" href="/">← All files</a>
      </div>
      <div class="panel" style="padding:0">
        <table>
          <thead><tr><th>When</th><th>Action</th><th>Key</th><th>Size</th></tr></thead>
          <tbody>
            ${rows.length === 0
              ? html`<tr><td colspan="4" class="muted" style="padding:1.25rem">No activity yet.</td></tr>`
              : rows.map(
                  (r) => html`<tr>
                    <td class="muted">${r.at.replace("T", " ").slice(0, 19)}</td>
                    <td><span class="tag">${r.action}</span></td>
                    <td>${r.key}</td>
                    <td class="muted">${r.size != null ? `${r.size} B` : ""}</td>
                  </tr>`,
                )}
          </tbody>
        </table>
      </div>
    `,
  );
}
