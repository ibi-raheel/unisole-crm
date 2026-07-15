# UniSole CRM — Prioritized Roadmap

_Snapshot date: 2026-07-15. This reflects the system as it stands: a working
MVP (auth, carriers, loads, dashboards, team, RLS-backed security) running
locally against a live Supabase project, currently holding only `[SIM]` demo
data._

Priorities are ordered by **value-to-effort and dependency** — earlier phases
unblock or de-risk later ones. Effort is rough: **S** = ~1 day, **M** = a few
days, **L** = 1–2 weeks.

---

## Phase 0 — Go-live readiness (blockers before real users)

The app works, but it can't be *used* by the team until these are done.

| # | Item | Why it's a blocker | Effort |
|---|------|--------------------|--------|
| 0.1 | **Deploy to the cloud** (Vercel + the existing Supabase project) | It only runs on your laptop today. Nothing else matters until the team can open a URL. | **M** |
| 0.2 | **Edit / deactivate team members** | Right now you can only *create* agents & dispatchers. You can't fix a typo, change a target, or offboard someone who leaves. | **M** |
| 0.3 | **Clear demo data & real onboarding** | Remove all `[SIM]` rows; create the real admin, agents, dispatchers, and targets. | **S** |
| 0.4 | **Password reset / change** | People forget passwords; admin needs a way to reset without touching Supabase. | **S** |
| 0.5 | **Empty/error-state polish** | First-run screens shouldn't look broken when there's no data yet. | **S** |

**Exit criteria:** the real team can log in at a URL and start entering live carriers.

---

## Phase 1 — Core operational value (daily-use features)

Once live, these are what make people *keep* using it instead of a spreadsheet.

| # | Item | Value | Effort |
|---|------|-------|--------|
| 1.1 | **Document uploads** (carrier packet, signed agreement, MC authority) | Onboarding a carrier *is* paperwork. Storing it against the carrier is core, not optional. Supabase Storage makes this native. | **L** |
| 1.2 | **Follow-up & stalled-carrier reminders** (email) | The whole point of the pipeline is not letting sales go cold. Automated nudges for overdue follow-ups and "signed-but-not-shipped" carriers. | **M** |
| 1.3 | **Payment tracking → light invoicing** | Move beyond a status field: record payment received, generate a simple invoice/statement per load or per carrier. | **L** |
| 1.4 | **Activity timeline per carrier** | One merged, chronological feed (status changes + follow-ups + notes + loads) instead of separate sections. | **M** |

**Exit criteria:** a dispatcher/agent can run their whole day in the app.

---

## Phase 2 — Visibility & decision-making (management value)

You asked for a "comprehensive place" — this deepens that for oversight.

| # | Item | Value | Effort |
|---|------|-------|--------|
| 2.1 | **Month picker / historical reporting** | Dashboards show "this month" only. Compare months, see trends, review past performance. | **M** |
| 2.2 | **Per-person drill-down pages** (from the Team tab) | Click a person → their full carrier & load list, history, and target trend. | **M** |
| 2.3 | **CSV export** (carriers, loads, targets) | For accounting, board reports, backups. | **S** |
| 2.4 | **Dashboard enhancements** | Revenue trend chart, conversion rates between pipeline stages, agent→dispatcher handoff time. | **M** |

**Exit criteria:** you can answer "how are we doing?" without leaving the app.

---

## Phase 3 — Scale & polish (as the team grows)

| # | Item | Value | Effort |
|---|------|-------|--------|
| 3.1 | **CSV / bulk import** of existing carriers | Migrate whatever's in spreadsheets today. | **M** |
| 3.2 | **Mobile-optimized layouts** | Dispatchers/agents on the road. Works now, but not tuned for phones. | **M** |
| 3.3 | **Audit-log viewer** | The DB already records every change — surface it for admins. | **S** |
| 3.4 | **City-level map precision** | Upgrade the loads map from state-level to exact-city pins (needs a geocoding provider + key). | **M** |
| 3.5 | **Notifications center / in-app alerts** | Beyond email — an in-app inbox for reminders and handoffs. | **M** |

---

## Recommended immediate sequence (next ~2 weeks)

1. **0.1 Deploy** — get it on a URL (highest unblock)
2. **0.2 Edit/deactivate team** — you can't run a team without this
3. **0.3 Real data onboarding** — retire the `[SIM]` rows
4. **1.2 Follow-up reminders** — fastest path to "this saves me time"
5. **1.1 Document uploads** — start it early; it's the biggest single piece

Everything above Phase 3 is deferrable without hurting daily use.

---

## Notes on what's already solid (don't re-build)

- **Security model** (row-level security + immutable rules) is done and enforced in the database.
- **Core data model** (carriers, loads, history, targets) is complete and correct.
- **Design system** is built and consistent across pages.
- **Reporting math** (targets, earnings, stalled sales) is computed server-side and trustworthy.
