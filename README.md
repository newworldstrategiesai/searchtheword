# SearchTheWord

Church sermon search — Next.js (App Router), Tailwind, shadcn/ui, Supabase (Postgres FTS), Vercel.

## Prerequisites

- Node 20+
- A [Supabase](https://supabase.com) project

## Setup

1. **Clone and install**

   ```bash
   npm install
   ```

2. **Environment**

   Copy `.env.local.example` to `.env.local` and fill in your Supabase URL and keys from **Project Settings → API**.

3. **Database**

   In the Supabase SQL editor (or `supabase db push` if you use the Supabase CLI), run migrations in order:

   - [`supabase/migrations/001_initial_schema.sql`](supabase/migrations/001_initial_schema.sql)
   - [`supabase/migrations/002_search_functions.sql`](supabase/migrations/002_search_functions.sql) (superseded by 004 for search RPC)
   - [`supabase/migrations/003_fhmi_schema.sql`](supabase/migrations/003_fhmi_schema.sql) — FHMI columns, `sermon_scripture_refs`, keyword `kind`, expanded FTS
   - [`supabase/migrations/004_search_sermons_v2.sql`](supabase/migrations/004_search_sermons_v2.sql) — `search_sermons` v2 (modes, highlights, filters)

   Optionally run [`supabase/seed.sql`](supabase/seed.sql) for sample rows (may need adjusting after 003).

   Smoke / EXPLAIN helpers: [`supabase/tests/search_smoke.sql`](supabase/tests/search_smoke.sql).

4. **Admin user**

   Create a user in **Authentication → Users**, then in **Authentication → Users → user → Raw App Meta Data** add:

   ```json
   { "role": "admin" }
   ```

   (Or set `app_metadata.role` to `admin` via SQL/API.)

5. **Import teachings (CSV or XLSX)**

   **Legacy CSV:** `sermon_title`, `preacher`, `date`, `scripture_reference`, `keywords`, `summary`, `full_text`, `media_url`

   **FHMI-style sheet (e.g. `data/fhmi-sermon-index.xlsx`):** columns such as `ID`, `Title`, `Speaker`, `Date Delivered`, `Series`, `Primary Scripture`, `Secondary Scriptures` (typo `Seconday` is accepted), `Topics`, `Keywords`, `CORE DOCTRINE`, `Summary`, `Google Drive Link`, etc.

   ```bash
   npm run ingest -- --file ./data/sample.csv
   npm run ingest -- --file ./data/fhmi-sermon-index.xlsx
   ```

   Or sign in at `/login` and upload from `/admin` (CSV or Excel).

## Development

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Deploy (Vercel)

1. Push the repo to GitHub/GitLab/Bitbucket.
2. Import the project in [Vercel](https://vercel.com).
3. Add environment variables (same as `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - Do **not** add `SUPABASE_SERVICE_ROLE_KEY` to Vercel unless you run trusted server-only jobs; use it only for CI/ingest scripts or Edge-safe alternatives.

4. Deploy. After deploy, confirm Supabase **Authentication → URL Configuration** includes your production URL (and redirect URLs for `/login`).

## Project structure

- `src/app` — routes (home, search, sermon detail, login, admin) and API routes
- `src/components` — UI (search bar, cards, topic cloud, etc.)
- `src/lib` — Supabase clients, ingest, search helpers
- `scripts/` — CSV ingest CLI
- `supabase/migrations/` — SQL schema and `search_sermons` RPC

## API routes

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/search?q=&page=&limit=&mode=&series=&document_type=&preacher=` | Search (`mode`: all, scripture, topic, fulltext) |
| `GET` | `/api/sermons/[id]` | Sermon detail + keywords |
| `GET` | `/api/keywords` | All keywords (topic cloud) |
| `POST` | `/api/ingest` | CSV upload (admin JWT only) |

## Phase 2+

Semantic search (pgvector), embeddings, and AI Q&A are out of scope for this MVP; add a `vector` column and hybrid search when ready.
