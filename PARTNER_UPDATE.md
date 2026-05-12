# SearchTheMessage / SearchTheWord — partner update

Paste this into Google Docs as plain text, then apply headings if you want.

---

## Summary

We shipped a mix of **easier admin tools**, **more reliable sermon search setup**, **smarter login redirects**, and **new AI helper surfaces** (admin copilot + public Ask). Admins can now edit sermons **directly on the public sermon page** when they are logged in.

---

## 1. Admin screen: simpler for volunteers

The `/admin` “Church admin” area was rewritten so it is **short and plain-language** (fewer developer notes, no jargon like “embeddings” in the main text).

- **Add sermons** tab: upload a spreadsheet, add a PDF, copy text from Google where links are set up, then **Refresh search for all sermons**.
- **Spreadsheet help** tab: a very short checklist of what columns matter and a simple weekly step list.
- Buttons and error messages use everyday words where possible.

---

## 2. “Smart search” / updating the whole library

Background: **semantic search** (and Ask) need OpenAI to turn sermon text into vectors. If OpenAI shows “quota” or billing errors, new chunks may not build until that is fixed.

**What we changed**

- **Refresh search** now runs in **small batches** on the server so long jobs are less likely to **time out** on hosting (Vercel).
- The API can process the list in chunks; the admin button loops until everything is covered.
- Longer **server time limit** on that step where the platform allows it.
- Short on-screen note: sermons need real **transcript / text** in the database for search to have something to index.

**What you still need operationally**

- Working **OpenAI billing** / quota for the project tied to `OPENAI_API_KEY`.
- Sermons should have **text** (spreadsheet column, PDF upload, or “Copy from Google” where applicable) before expecting search to behave.

---

## 3. Edit sermons on the public sermon page

On any normal sermon URL (the page members see), e.g.  
`https://www.searchthemessage.com/sermon/<id>`

If someone is **logged in as an admin**, they now see a small **admin strip**: **Edit**, **New sermon**, **All sermons**.

- **Edit** opens the same full form as the admin sermon list (title, preacher, text, links, tags, etc.).
- **Save** refreshes the page so the public view updates.
- **Delete** removes the sermon and sends them back to search.
- **New sermon** creates a record and opens the new sermon page.

No change for regular visitors — they never see these controls.

---

## 4. Admin sermon list

The **All sermons** admin table got usability work (search, sort, filters, mobile-friendly cards, refresh, and inline editing flow). Same data as before; easier to work through many rows.

---

## 5. Login and redirects

After sign-in, the app now prefers a **full navigation** in some cases so the session cookie is definitely picked up on the next load (fixes “I’m logged in but admin says no” type issues).

- Uses `NEXT_PUBLIC_APP_URL` in production when set (e.g. `https://www.searchthemessage.com`).
- **Admins** trying to open an admin-only link while logged out are sent through login and then **returned** to what they wanted.
- Helpers live in `post-login.ts` and are wired from the login UI.

---

## 6. Ask page + floating Ask widget

- The **Ask** experience was refactored into dedicated components (chat UI, citations, etc.).
- A **floating entry point** for Ask can appear from the main layout (for eligible users / pages as configured) so people can open Ask without hunting for the route.

(Exact visibility rules follow whatever we set in layout — e.g. signed-in vs public.)

---

## 7. Admin AI “copilot”

There is an **admin-only assistant** (API + UI) that can:

- Help navigate the app (“where do I upload?”).
- Answer questions grounded in the **indexed sermon archive** (with tool calls to search / list / get sermon details).
- **Propose** sensitive actions (e.g. refresh search, Google copy, delete) so the human must click **Confirm** before anything runs.

Prompt and tools live under `src/lib/admin-assistant/`. Requires the usual OpenAI (or configured) model path on the server.

---

## 8. Small fixes and tooling

- **PDF import / text extraction** — minor hardening or typing (`pdf-extract`, related types).
- **Example env file** (`.env.local.example`) — documents variables partners/devs need (no secrets committed).
- **`supabase/grant_admin_by_email.sql`** — optional SQL helper to grant admin role by email in Supabase (run manually in the dashboard/SQL editor when onboarding someone).

---

## 9. What to tell the team

1. **Upload content** the same ways as before (spreadsheet, PDF, Google copy when configured).
2. After big imports, run **Refresh search for all sermons** once OpenAI is healthy.
3. Admins can **fix a single sermon** either from **All sermons** or **open the public sermon page → Edit**.
4. If search feels “empty” for some sermons, check that those rows have **actual text**, not just a title.

---

## 10. Deploy note

After pull/deploy, confirm production env vars (Supabase, OpenAI, Google service account if used, `NEXT_PUBLIC_APP_URL`) match the live domain.

---

*Document generated for internal partner sync. Adjust wording to your voice before sharing externally.*
