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

SQLite (`bun:sqlite`) is the source of truth for:

- **The S3 connection settings** (`app_config` table) — see below.
- Each object's last-known **content hash** plus an **audit log**. The hash is
  what powers the "only rewrite if updated" guarantee, so we never re-PUT an
  identical object to S3.

## S3 configuration (stored in the database)

The S3 bucket and credentials live in the `app_config` table, **not** in
environment variables. On startup the app checks whether the configuration is
present:

1. **If it's missing**, hard-coded default values are seeded into the database.
   These are placeholders (`REPLACE_ME_*`) and must be replaced with the correct
   bucket/credentials. The app logs a warning while placeholders are in use.
2. **If `S3_*` environment variables happen to be set** when the config is first
   seeded, those values are used as the seed instead of the placeholders (handy
   for existing setups / CI).

### Replacing the placeholder values

Edit the rows in the `app_config` table, e.g.:

```sql
UPDATE app_config SET value = 'my-real-bucket'        WHERE key = 's3.bucket';
UPDATE app_config SET value = 'AKIA...'               WHERE key = 's3.accessKeyId';
UPDATE app_config SET value = '...'                   WHERE key = 's3.secretAccessKey';
UPDATE app_config SET value = 'us-east-1'             WHERE key = 's3.region';
-- For R2 / MinIO / other S3-compatible storage:
UPDATE app_config SET value = 'https://...'           WHERE key = 's3.endpoint';
```

Restart the app (or it rebuilds the client on next change via
`resetS3Client()`). Works with AWS S3 out of the box; set `s3.endpoint` for
Cloudflare R2, MinIO or other S3-compatible storage.

## Setup

```bash
bun install
cp .env.example .env   # optional — only PORT / DB_PATH and seed values
```

`.env` values (bootstrap only):

| Variable                                                        | Notes                                                        |
| -------------------------------------------------------------- | ------------------------------------------------------------ |
| `PORT`                                                         | HTTP port, default `3000`                                    |
| `DB_PATH`                                                      | SQLite file path, default `./data.sqlite`                    |
| `S3_BUCKET` / `S3_REGION` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` / `S3_ENDPOINT` | Optional — used only to seed the DB config on first start |

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
  index.ts    Hono server + routes + startup config check
  config.ts   Bootstrap config (port, db path) + editable-extension rules
  settings.ts DB-backed S3 config: startup check + placeholder seeding
  s3.ts       Bun native S3 client wrapper (list/get/put/delete), built from DB config
  hash.ts     SHA-256 hashing + content-type guessing
  db.ts       bun:sqlite schema, metadata + edit-log queries
  files.ts    Save/delete service with change-detection
  views.ts    Server-rendered HTML + HTMX fragments
```
