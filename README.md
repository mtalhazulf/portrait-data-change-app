# S3 File Editor

A small **Hono + HTMX + SQLite** app (running on **Bun**) for managing files in
an S3 bucket from the browser. It lets you:

- 📋 **Browse** the objects in a bucket (with prefix filtering).
- ✏️ **Edit HTML / text files in place** — open them in a browser editor and save
  back to S3.
- ⬆️ **Upload any file** to a chosen key/location.
- 🗑️ **Delete** objects.
- 🧠 **Only rewrite a file when it actually changed** — every save computes a
  SHA-256 of the new content and compares it to the last-known hash stored in
  SQLite. If nothing changed, the S3 write is skipped.
- 🕑 An **edit history** log of every upload / edit / skip / delete.

## Why SQLite?

SQLite (`bun:sqlite`) tracks each object's last-known content hash plus an audit
log. The hash is what powers the "only rewrite if updated" guarantee, so we
never re-PUT an identical object to S3.

## Setup

```bash
bun install
cp .env.example .env   # then fill in your S3 credentials
```

`.env` values:

| Variable               | Notes                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| `S3_BUCKET`            | Bucket name (required)                                           |
| `S3_REGION`            | AWS region, default `us-east-1`                                  |
| `S3_ACCESS_KEY_ID`     | Access key (required)                                            |
| `S3_SECRET_ACCESS_KEY` | Secret key (required)                                            |
| `S3_ENDPOINT`          | Leave blank for AWS S3; set for R2 / MinIO / S3-compatible       |
| `PORT`                 | HTTP port, default `3000`                                        |
| `DB_PATH`              | SQLite file path, default `./data.sqlite`                        |

> Works with AWS S3 out of the box. For Cloudflare R2, MinIO or other
> S3-compatible storage, set `S3_ENDPOINT` to the provider's endpoint URL.

## Run

```bash
bun run dev     # hot-reload development server
bun run start   # production
bun run typecheck
```

Open http://localhost:3000.

## How "only rewrite if changed" works

1. When you open a file to edit, its current content is hashed and stored in
   SQLite (if not already tracked).
2. On save, the submitted content is hashed.
3. If the new hash equals the stored hash, the upload is **skipped** and the row
   is logged as `skip` — S3 is never touched.
4. Otherwise the object is written, and the stored hash + metadata are updated.

The same logic applies to uploads: uploading a byte-identical file to an
existing key is skipped.

## Project layout

```
src/
  index.ts    Hono server + routes
  config.ts   Env config + editable-extension rules
  s3.ts       Bun native S3 client wrapper (list/get/put/delete)
  hash.ts     SHA-256 hashing + content-type guessing
  db.ts       bun:sqlite schema, metadata + edit-log queries
  files.ts    Save/delete service with change-detection
  views.ts    Server-rendered HTML + HTMX fragments
```
