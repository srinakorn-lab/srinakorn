# CCU Split

This folder contains the CCU app split into separate HTML, CSS, and JavaScript files.

## Files

- `index.html`
- `styles.css`
- `app.js`
- `config.js` (create from `config.example.js`)

## Local use

Open `index.html` through a web server instead of `file://` if you want browser storage to behave more reliably.

## Cloud path

1. Deploy this folder to Cloudflare Pages or similar static hosting.
2. Copy `config.example.js` to `config.js`.
3. Fill in your Supabase values in `config.js`.
4. Create users in Supabase Auth with email/password.
5. For each user, set `user_metadata.dept` to `CCU`, `NCU`, `ICU`, or `admin` if you want the app to open the right view automatically.
6. Set `user_metadata.role` to `staff` or `admin`.
7. Turn on Supabase Realtime for `public.ccu_state` so all open browsers sync when one user saves.

## Supabase schema

Use this as the starting point in the Supabase SQL editor:

```sql
create table if not exists public.ccu_state (
  id text primary key,
  beds jsonb not null default '{}'::jsonb,
  wards jsonb not null default '{}'::jsonb,
  st_cfg jsonb not null default '{}'::jsonb,
  doctors jsonb not null default '[]'::jsonb,
  report_history jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

alter table public.ccu_state enable row level security;

create policy "read own dept or admin"
on public.ccu_state for select
to authenticated
using (
  id = 'META'
  or auth.jwt() -> 'user_metadata' ->> 'role' = 'staff'
  or auth.jwt() -> 'user_metadata' ->> 'role' = 'admin'
);

create policy "write own dept or admin"
on public.ccu_state for insert
to authenticated
with check (
  id = 'META'
  or id in ('CCU','NCU','ICU')
);

create policy "update own dept or admin"
on public.ccu_state for update
to authenticated
using (
  id = 'META'
  or id in ('CCU','NCU','ICU')
)
with check (
  id = 'META'
  or id in ('CCU','NCU','ICU')
);
```

In this model, staff can read all department rows, but can only write the row that matches their own `user_metadata.dept`. Admin can read/write all rows.

## Cloudflare Pages deploy

Use the folder root as the publish directory.

Suggested settings:

- Build command: none
- Output directory: `.` 
- Framework preset: none

Make sure `config.js` is present in the deployed site. Keep `config.example.js` only as a template.

## Notes

- Right now the app still uses local browser storage when Supabase is not configured.
- Login now uses Supabase Auth email/password when `config.js` is filled in.
- The Supabase sync path is scaffolded; the state table and auth shape are ready for the next wiring pass.
- The app reads `user_metadata.dept` / `role` first, then falls back to the email prefix for department selection.
- The cloud table is row-per-department plus `META`.
- The app now listens for Supabase realtime changes and reloads shared state when another browser saves.
