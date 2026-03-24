# SearchTheWord — QA checklist (browser)

Use this for manual regression testing before releases. Run in **Chrome** (or your primary browser) and once at **~390px width** for mobile.

## Preconditions

1. **Environment**
   - `.env.local` has valid Supabase URL and keys.
   - For **Ask AI**: configure the server-side chat/LLM API key when testing real answers. Without it, `/api/ask` returns a “not configured” fallback (expected).

2. **Data**
   - Prefer a small real dataset (imported sermons) so search, sermon pages, keywords, and series behave like production.
   - An empty database is OK for **UI smoke** only, not for validating search quality.

3. **Accounts**
   - **Public:** no login required for search and Ask.
   - **Admin:** staff user who can access `/admin` and `/admin/sermons` per your auth rules.

---

## Pass A — Smoke (5–10 min)

| Step | Action | Pass |
|------|--------|------|
| A1 | Open `/` | Hero loads; home search and sections render; no blank screen. |
| A2 | Header **Search** (or Browse) → `/search` | Search archive loads; mode tabs: All / Scripture / Topics / Full text. |
| A3 | Header **Ask AI** → `/ask` | Chat UI; message field + Send. |
| A4 | Header **Admin** → `/admin` | Admin loads, or redirects to login if unauthenticated (note which). |
| A5 | **Theme toggle** | Light ↔ dark; text stays readable. |
| A6 | **Mobile** (narrow): open menu sheet | Browse + main nav links work. |

---

## Pass B — Layer 1: Searchable database

Routes: `/`, `/search`, `/sermon/[id]`, `/series?series=…`

| Step | Action | Pass |
|------|--------|------|
| B1 | **Scripture-style queries** (e.g. `Acts 2:39`, `Romans 9`) | Results show title/date/snippet; click-through to sermon page with body text. |
| B2 | **Topic / doctrinal terms** (e.g. Remnant, Jubilee) | Relevant rows; tags/keywords if populated. |
| B3 | **Phrase / full-text** (exact phrases from your archive) | Snippets match; pagination if many hits. |
| B4 | **Search modes** on `/search`: All / Scripture / Topics / Full text | Behavior differs sensibly; URL reflects state (bookmarkable). |
| B5 | **Filters:** Speaker, Series, Document type, From / To + Apply | List narrows; no broken pagination. |
| B6 | **Home hero:** search mode radios + Search | Navigates to search with expected behavior. |
| B7 | **Sermon detail** from a result | Title, date, transcript/body, PDF/link if present; no 500. |
| B8 | **Series browse** | Use `/series?series=<name>` from a real series. Note: `/series` with no `series` param redirects to `/search` (by design). |

---

## Pass C — Layer 2: Ask AI

Route: `/ask`

| Step | Action | Pass |
|------|--------|------|
| C1 | Send a short question | Assistant reply appears; input clears; loading ends. |
| C2 | Unconfigured API | Clear fallback telling admin to configure env (not a silent failure). |
| C3 | Configured API | On-topic reply; errors use toast + inline message. |
| C4 | Inline link to **Search** | Navigates to `/search`. |

---

## Pass D — Upload & ingestion

Route: `/admin`

| Step | Action | Pass |
|------|--------|------|
| D1 | Import spreadsheet/CSV (valid template) | Progress feedback; rows appear in admin list and/or search. |
| D2 | PDF upload (if used) | Success or clear error; transcript/storage per design. |
| D3 | Invalid file / empty upload | Validation message; no silent failure. |

---

## Pass E — Admin: list & edit

Route: `/admin/sermons`

| Step | Action | Pass |
|------|--------|------|
| E1 | List + pagination | Loads; loading state then data. |
| E2 | Create sermon | Saves; appears in list and search. |
| E3 | Edit fields (title, date, series, keywords, etc.) | Persists; visible on sermon page and search. |
| E4 | Delete (if implemented) | Removed from list and search. |

---

## Pass F — Auth

Route: `/login`

| Step | Action | Pass |
|------|--------|------|
| F1 | Staff sign-in | Reaches admin or intended redirect. |
| F2 | Admin API/session | `/admin` and `/api/admin/*` work when logged in. |
| F3 | Sign out (if available) | Admin routes redirect or 401 as expected. |

---

## Pass G — Edge cases & polish

| Step | Action | Pass |
|------|--------|------|
| G1 | `/sermon/<invalid-id>` | Friendly not-found page. |
| G2 | Keyboard: Tab through search, filters, Ask | Focus order usable. |
| G3 | Large archive smoke | First search still acceptable (note slowness for follow-up). |

---

## Spreadsheet matrix (optional)

| ID | Area | Route | Test | Expected |
|----|------|-------|------|----------|
| T1 | Home | `/` | Load | Hero + sections |
| T2 | Search | `/search?q=…` | Modes + filters | Correct narrowing |
| T3 | Sermon | `/sermon/[id]` | Full document | Metadata + text |
| T4 | Series | `/series?series=…` | Browse | Series-scoped list |
| T5 | Ask | `/ask` | Chat | Reply or configured fallback |
| T6 | Admin ingest | `/admin` | Import | Rows + feedback |
| T7 | Admin CRUD | `/admin/sermons` | CRUD | DB + search reflect edits |
| T8 | Login | `/login` | Session | Admin access |

---

## Release sign-off

- [ ] Pass A complete  
- [ ] Pass B complete (with real data)  
- [ ] Pass C complete (config documented)  
- [ ] Pass D–E complete (if releasing admin)  
- [ ] Pass F complete (if staff workflows ship)  
- [ ] Pass G spot-check  

**Tester:** _______________ **Date:** _______________ **Build / commit:** _______________
