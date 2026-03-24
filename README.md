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

   In **Supabase → SQL Editor**, run [`supabase/setup_complete.sql`](supabase/setup_complete.sql) once (full schema + `search_sermons` v2). Or run migrations `001` → `003` → `004` in order (`002` is superseded by `004`).

   Optionally run [`supabase/seed.sql`](supabase/seed.sql) for sample rows (adjust for keyword `(name, kind)` if needed).

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

## GitHub

1. Create a new empty repository on [GitHub](https://github.com/new) (no README/license if you already have them locally).
2. In the project folder:

   ```bash
   git remote add origin https://github.com/YOUR_USER/YOUR_REPO.git
   git push -u origin main
   ```

   If GitHub shows a different default branch name, follow its instructions or rename with `git branch -M main`.

## Deploy (Vercel)

1. Sign in at [vercel.com](https://vercel.com) with GitHub and **Add New… → Project**.
2. **Import** your GitHub repository. Framework Preset should detect **Next.js**; leave defaults (root = repo root, `npm run build`, output handled by Next).
3. **Environment Variables** (before first deploy, or under Project → Settings → Environment Variables):

   | Name | Value |
   |------|--------|
   | `NEXT_PUBLIC_SUPABASE_URL` | Supabase **Project Settings → API → Project URL** |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase **anon public** key |
   | `OPENAI_API_KEY` | *(Optional)* For **Ask AI** chat in production |

   Use **Production** (and **Preview** if you want preview deployments to hit Supabase too). Do **not** commit `.env.local`; do not put the **service role** key in client-exposed env vars.

4. **Deploy**. When the build finishes, open the `.vercel.app` URL.
5. In **Supabase → Authentication → URL Configuration**, add:

   - **Site URL**: `https://your-app.vercel.app` (your production URL)
   - **Redirect URLs**: `https://your-app.vercel.app/**` and `http://localhost:3000/**` for local login

6. Re-deploy or wait for the next push; test **login**, **search**, and **admin** with an `app_metadata.role = admin` user.

### Troubleshooting: “supabaseUrl is required” or missing Supabase on Vercel

`NEXT_PUBLIC_*` variables are embedded at **build** time. If you added them in Vercel **after** the first deploy, the running build still has empty values until you **redeploy**.

1. **Vercel → Project → Settings → Environment Variables** — confirm both names match exactly: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no typos, no trailing spaces).
2. Enable them for **Production** and, if you use PR previews, **Preview**.
3. **Deployments →** open the latest deployment → **⋯ → Redeploy** (optionally clear build cache).
4. Push a new commit if you prefer redeploy from git.

Local: put the same keys in `.env.local` in the **project root** (same folder as `package.json`), one variable per line, then restart `npm run dev`.

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
