-- Grant admin: sets raw_app_meta_data.role = 'admin' (used by JWT app_metadata and RLS).
-- Run in Supabase Dashboard → SQL Editor.
--
-- After running: the user must sign out and sign in again (or get a fresh JWT) so the session includes admin.

update auth.users
set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || jsonb_build_object('role', 'admin')
where lower(email) = lower('brothervaughn@gmail.com');

-- Optional check:
-- select id, email, raw_app_meta_data from auth.users where lower(email) = lower('brothervaughn@gmail.com');
