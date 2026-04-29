# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**İhtilaflı Data KPI Dashboard** — A call-center KPI tracking and management dashboard for a customer service team. Built in Turkish. Used by agents (temsilci) and admins (yönetici).

## Current State (Pre-Migration)

The entire application is a single `index.html` file (2,200+ lines) combining HTML, CSS, and JavaScript. There is no build system, no package manager, no backend. All dependencies are loaded via CDN:
- Supabase JS v2 — database client (used directly from browser)
- Tailwind CSS — utility-first styling (CDN config in `<script>`)
- SheetJS (xlsx) — Excel export
- Font Awesome — icons

**To develop:** open `index.html` in a browser or serve it with any static file server (e.g. `python3 -m http.server`). There are no build steps.

## Planned Architecture (Next.js Migration)

The project is being migrated to Next.js + backend. The migration addresses two critical issues: Supabase anon key exposed in browser, and excessive egress (every user fetches full tables directly from Supabase with `limit(10000)`).

Target stack:
- Next.js (App Router, TypeScript, Tailwind)
- API Routes as backend — all Supabase queries move server-side
- `@supabase/ssr` for auth middleware
- Server-side caching (node-cache or Next.js `unstable_cache`, 1-hour TTL)
- Service role key only on server; anon key only for auth

Future planned feature: Excel upload endpoint (`POST /api/import`) that parses uploaded Excel files, runs the KPI calculations currently done in Google Sheets, shows a preview/edit step, then writes to Supabase via service role key. This will replace the current pipeline: PowerBI → Excel → Google Sheets (Apps Script) → Supabase.

## Supabase Tables

| Table | Purpose | Cache? |
|---|---|---|
| `daily_data` | Per-agent per-day login/break/cwt minutes | Yes (1h) |
| `period_summary` | Aggregated monthly KPI per agent | Yes (1h) |
| `performance_data` | Transaction count by agent/day | Yes (1h) |
| `goalpex_data` | Goalpex scoring per period | Yes (1h) |
| `users` | User list with `user_name`, `user_mail`, `role`, `team`, `team_leader` | No |
| `feedback` | Feedback records between users | No |
| `feedback_messages` | Threaded replies on feedback | No |
| `announcements` | Team announcements with optional image | No |
| `announcement_reads` | Read receipts per user per announcement | No |

Tables without cache (`announcements`, `feedback`, `users`) require real-time accuracy. The current client-side cache proxy at `index.html:883` already reflects this split.

Data is written to Supabase externally via Google Apps Script (3 functions covering the 3 cached table groups). The dashboard is read-only for all data except feedback and announcements.

## Authentication & Roles

Auth is handled by Supabase Auth (email + password). After login, `showDashboard()` at `index.html:1000` fetches the user's record from the `users` table to determine role.

Two roles, enforced client-side via `applyRoleRestrictions()` at `index.html:1012`:

**admin:** sees all data for all agents, has export buttons, can manage announcements (create/archive/delete), can see feedback for all agents, sees CWT and FTE KPI cards, sees Goalpex prim (bonus) column.

**agent:** sees only their own feedback tab ("Bana Ait"), CWT/FTE cards hidden, Goalpex export hidden, Goalpex prim column hidden (`.agent-view .goalpex-admin-col { display:none }`), no announcement management.

Polling intervals set on login: feedback badge check every 30s (agent only), duyuru popup check every 5s (agent only), alarm check every 5s (all).

## Navigation & Pages

Five pages toggled by `showPage(p)` at `index.html:960`:
- `uretim` — main KPI view (production/üretim data)
- `performans` — daily transaction performance
- `goalpex` — Goalpex scoring and bonus simulation
- `feedback` — feedback panel with threaded replies
- `duyurular` — announcements/duyuru panel

Nav IDs follow the pattern `nav-{page}`, page containers follow `page-{page}`.

## KPI & Scoring Formulas

These formulas live in Google Sheets today but will move to the Next.js import endpoint:

```
working_days     = COUNT(days with data)          // =COUNT(I2:AL2)
missing_time     = working_days × 570 − SUM(login_minutes)
break_ratio      = SUM(break_minutes) / SUM(login_minutes)
net_cwt_minutes  = login_minutes − (coffee_break + lunch_break)
fte_target_hours = (MIN(today−1, period_end) − period_start + 1) × (195/30)
fte              = SUM(net_minutes) / 60 / fte_target_hours
```

Goalpex scoring functions (already in JS, `index.html:1301-1308`):
- `calcPerfPuan(v)` — performance score (0/10/20/30/45 based on ≥90/95/110/120%)
- `calcKalitePuan(v)` — quality score (25 if ≥97%, else −120)
- `calcQuizPuan(v)` — quiz score (0/5/10)
- `calcSikayetPuan(v)` — complaint penalty (−120 if ≥1)
- `calcDevamsizPuan(v)` — absence penalty (0/−15/−120)
- `getPrim(p)` — maps total score to bonus bracket (₺2,000–₺4,200, min 80 pts)

## Key Global State (Current)

```js
currentUser       // { role, user_name, email }
fullData          // period_summary rows for current period
rawUsers          // all users from users table
cwtAllData        // daily_data rows
perfAllData       // performance_data rows
dailyAllData      // daily breakdown
fbAllData         // all feedback records
_selectedMetric   // active KPI metric in üretim view
```

## Feedback System

Feedback has types: `Olumlu` (positive), `Bilgilendirme` (informational), `Olumsuz` (negative).
Topics: `Kalite`, `KPI`, `Operasyonel` — each topic has a fixed title list in `FB_TITLES` at `index.html:932`.
`is_read` field drives badge counts and popup notifications. Admins can delete feedback (cascades to `feedback_messages`).

## Announcements (Duyurular)

Announcements have categories and optional team targeting (`team` field, or `'all'`). Images stored in Supabase Storage bucket `duyuru-gorseller`. Read tracking via `announcement_reads` table. Admins see read-rate percentages. Popup shown on login for unread announcements with `alarm_minutes` set.

