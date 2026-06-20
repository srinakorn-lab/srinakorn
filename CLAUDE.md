# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Critical System** (ระบบบริหารหอผู้ป่วยวิกฤต) is a hospital ICU management web application for 3 wards:
- **CCU** (หอผู้ป่วยวิกฤตโรคหัวใจ) — 9 beds, types: CCU / IMCCU / ฝากนอน
- **NCU** (หอผู้ป่วยวิกฤตระบบประสาท) — 7 beds, types: NCU / IMNCU / ฝากนอน
- **ICU** (หอผู้ป่วยวิกฤตอายุรกรรม) — 13 beds, types: ICU / IMCU / ฝากนอน

## Running Locally

There is **no build step**. The app is pure vanilla HTML/CSS/JS loaded directly in a browser.

```bash
# Must serve via HTTP (not file://) due to CORS restrictions from CDN scripts and Supabase
npx http-server

# Then open http://localhost:8080
```

**First-time setup:**
```bash
cp config.example.js config.js
# Edit config.js and fill in Supabase URL + anon key (and optionally anthropicKey)
```

`config.js` is gitignored. It exposes `window.CFG` with `supabaseUrl`, `supabaseKey`, and `anthropicKey`.

## File Structure

| File | Purpose |
|------|---------|
| `index.html` | Full HTML structure — all modals, pages, and UI are inline here |
| `styles.css` | All CSS. Uses CSS variables (`--blue`, `--red`, `--teal`, etc.) |
| `app.js` | All JavaScript logic (~1400 lines) |
| `config.js` | Runtime config (gitignored, create from `config.example.js`) |
| `config.example.js` | Template for config.js |
| `Rls basic.sql` | Supabase RLS policy — run in Supabase SQL Editor when setting up |

No `package.json`, no bundler, no framework, no TypeScript.

## Architecture

### Data Model

All state lives in module-level globals in `app.js`:
- `allBeds` — `{ CCU: { "1": BedObj, "2": BedObj, ... }, NCU: {...}, ICU: {...} }`
- `wards` — shift info per dept: `{ CCU: { inCharge, teamLead, codeBlue, doctorNight, shiftRN[], shiftPN[] } }`
- `stCfg` — master RN/PN roster per dept: `{ CCU: { RN: [...], PN: [...] } }`
- `doctors` — `[{ name, spec, workType }]`
- `rptHist` — parsed report history (last 5 days, max 10 entries)

A **BedObj** contains: `id`, `dept`, `deptType`, `dx[]`, `patientCode`, `master`, `consult[]`, `rn`, `plan`, `checks[]`, `gender`, `age`, `admitDate`, `los`, `orNote`, `ccNote`, `presentNote`, `class` (1–5 severity), `class5Items[]`, `class5Other`, `transferWard`, `transferRoom`, `transferBed`, `transferRoomType`, `transferMonitor`, `transferGenderPref`, `transferTime`.

### Persistence

Two layers with automatic fallback:

1. **Supabase** (primary) — table `ccu_state`, one row per dept (id = `"CCU"` / `"NCU"` / `"ICU"`), columns are jsonb: `beds`, `wards`, `st_cfg`, `doctors`, `report_history`
2. **localStorage** (fallback, key `ccu_v3`) — used when Supabase is unavailable

Key functions:
- `persist()` — saves the **currently active dept only** (`editDept || dept`). Called after every bed/staff save.
- `saveAll()` — saves all three depts. Used after doctor/staff list changes.
- `load()` — loads all depts from Supabase (or localStorage). Called on init and realtime events.
- `loadAll()` — calls `load()` then merges default staff/doctors; used in admin mode.

### Application Modes

`switchMode(m)` toggles between:
- `'dashboard'` — main bed table + staff strip (div `#dash-mode`)
- `'transfer'` — transfer dashboard showing patients pending ward move (div `#transfer-mode`)
- `'admin'` / `'import'` — admin panel with tabs: Import, Doctors, RN/PN, Users (div `#admin-mode`)

### Auth

Supabase email/password auth (`doLogin()`). On success, `afterLogin(dept, role)` hides the login screen and calls `initApp()`. Role `'admin'` unlocks the Admin nav button. Role `'staff'` is the default; sees Dashboard, Transfer, Import, and Password-change only.

Offline fallback: hardcoded users `admin/1234`, `ccu/1234`, `ncu/1234`, `icu/1234`.

User metadata (`user_metadata.role`, `user_metadata.dept`) in Supabase Auth controls access.

### Realtime Sync

`setupRealtime()` in `app.js` subscribes to Postgres changes on `ccu_state` via Supabase Realtime. On any change it calls `load()` → `renderTable()` + `renderStaff()`.

### Report Import / AI Parsing

The Import tab parses CCU handoff reports (PDF, DOCX, TXT, images, Excel) into bed data.

- **Offline mode** (`parseCCU()`) — regex-based parser, no network needed
- **AI mode** (`aiParseText()` / `callAnthropic()`) — sends text to Claude API (model: `claude-sonnet-4-20250514`)
  - Prefers routing through a Supabase Edge Function `ai-parse` (keeps API key server-side)
  - Falls back to direct Anthropic API call using `window.CFG.anthropicKey` if Edge Function returns 404
- **Excel mode** (`handleNCUExcel()`) — uses SheetJS loaded from CDN, maps columns A–N to bed fields

External libraries are loaded **on-demand from CDN** (never bundled): pdf.js, mammoth.js, SheetJS (`xlsx`), Supabase JS SDK.

### Plan & Checklist System

Each bed has a `plan` (one of: `อยู่ต่อ`, `รอรับใหม่`, `plan D/C`, `D/C`, `refer`, `ย้ายward รอห้อง`, `ย้าย ward ได้ห้องแล้ว`). Plans `D/C` and `refer` trigger a checklist (`CL` constant). When all checklist items are checked, `autoClear()` can auto-empty the bed.

Plans `ย้ายward รอห้อง` and `ย้าย ward ได้ห้องแล้ว` show extra transfer fields (room type, ward, room number). The Transfer mode (`renderTransferDashboard()`) shows a two-column summary of all patients in these two plan states.

## Supabase Setup

Run `Rls basic.sql` in the Supabase SQL Editor. The policy allows all authenticated users to read/insert/update; anon users have no access; delete is not permitted (clearing a bed is an update, not a delete).

The `ccu_state` schema (from README):
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
```

## Known Stub Functions

The following functions in `app.js` are partially or not yet fully implemented (noted in README as stubs):
- `renderMasterList()`, `renderConsultList()`, `renderCheckList()` — render helpers for the admin list views
- `renderHist()` — report history rendering (partially exists)
- `renderSpecTabs()`, `renderDrList()` — doctor page rendering (partially exists)
- `addSt(role)`, `remSt(role, name)` — admin staff list add/remove (note: shift-level equivalents `addSM`/`remSM` do work)

When implementing these, refer to the original file `ccu_combined_4.html` (referenced in README) for the intended logic.

## Key Conventions

- **Language**: Thai throughout UI text, variable names, and comments. English for code structure.
- **Bed IDs**: 1-based numeric strings (`"1"`, `"2"`, ...), not integers.
- `editDept` tracks the department being edited in the bed modal; `dept` tracks the currently viewed department in the main selector.
- When in "ALL" view (`dept === 'ALL'`), `isAllView()` returns true and `editDept` defaults to `'CCU'` for new edits.
- `sanitizeBedPrivacy()` must be called before saving a bed — it strips any fields not in the whitelist (PDPA compliance: no patient names, HN, AN).
- Color constants (`TC`, `PC`, `DXC`, `CLASS_COLORS`, `SC`) are plain objects keyed by type/plan/class, each with `{bg, tx, br}` for inline style application.
- Toast notifications use `toast(message, bgColor)`.
- All modals use the `.open` CSS class to show/hide.
