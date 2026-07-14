# UniSole IT Hub LLC — Dispatch CRM
## Product Requirements Document (PRD)

**Version:** 2.0
**Date:** July 2026
**Status:** Draft — open questions resolved
**Owner:** UniSole IT Hub LLC

---

## 1. Overview

### 1.1 What the company does

UniSole IT Hub LLC operates a **truck dispatching business**. The business has two distinct functions:

1. **Sales** — Sales Agents find trucking companies (Carriers) and sign them up as clients.
2. **Dispatch** — Once signed, a Carrier is assigned to a Dispatcher, who finds and books Loads (freight jobs) for that Carrier's trucks. The company earns a service charge (a % of each load's rate).

The value chain:

```
Sales Agent signs a Carrier
        ↓
Carrier is assigned to a Dispatcher
        ↓
Dispatcher books Loads for that Carrier
        ↓
Company earns a % service charge per Load
        ↓
Performance is measured against Targets
```

### 1.2 The problem today

The business currently runs on **four disconnected Google Sheets**:

| Sheet | Purpose |
|---|---|
| Sales Record | Tracks carriers signed by each sales agent, and their status (Alive / Active / Dead / No Agreement) |
| Dispatch Record | Tracks loads per dispatcher, with pickup/delivery, rate, service charge, payment status |
| Dispatch/Carrier Record | A second, overlapping view of the same load data, organized by date |
| Targets | Weekly/monthly targets per dispatcher, manually totalled |

**Core problems:**

- **Duplication** — the same carrier, dispatcher, and agent names are retyped across multiple sheets. Change one, and the others go stale.
- **No single source of truth** — the same load appears in two sheets with slightly different framings, so it's unclear which is authoritative.
- **Manual totals** — targets and performance numbers are added up by hand, so they drift out of sync with reality.
- **No follow-up tracking at all** — there is currently no record of when a carrier was last contacted, how many times, or why a carrier went Dead. This is the single biggest data gap.
- **No access control** — every sales agent can see every other agent's data.

---

## 2. Goals

### 2.1 Primary goals

1. **Track every sale** — every carrier that a sales agent contacts or signs, with a clear status and full history.
2. **Track follow-ups** — every contact attempt with a carrier: when, by whom, what was said, what the outcome was, and when the next follow-up is due.
3. **Track what happens to a sale over time** — status changes from first contact → signed → active → dead, with dates, so the business can see where and why sales are lost.
4. **Understand dispatch strengths** — by recording every load (what it was, where it was picked up, where it was delivered, what it paid), the business can learn which lanes, rates, carriers, and dispatchers perform best.
5. **Two levels of access** — a Sales Agent sees only their own records; an Admin sees everyone's.

### 2.2 Secondary goals

- Eliminate manual totalling — all targets and performance figures calculate themselves from underlying data.
- Eliminate duplicate data entry — every entity is entered once and referenced everywhere else.

### 2.3 Non-goals (explicitly out of scope for v1)

- Load board integration (automatically pulling available loads from external sources)
- Invoicing / accounting integration
- Automated email/SMS sending to carriers
- Mobile app (web-responsive is sufficient)

---

## 3. Users and Roles

| Role | Can see | Can do |
|---|---|---|
| **Sales Agent** | Only carriers they personally own, and follow-ups on those carriers | Add a new carrier; log follow-ups; update carrier status; view their own target progress |
| **Dispatcher** | Only carriers assigned to them, and loads they booked | Add and update loads; view their own target progress |
| **Admin** | Everything — all agents, all dispatchers, all carriers, all loads, all follow-ups | All of the above, plus: manage users, set targets, reassign carriers, view all reports |

**Key access rule:** ownership is enforced by a field on each record (`sales_agent_id` on a carrier, `dispatcher_id` on a load). The system filters by the logged-in user's ID for non-admin roles.

---

## 4. Data Model / Architecture

Six core entities. Each exists exactly once and is referenced by ID everywhere else — this is what eliminates the duplication problem.

### 4.1 Entity relationship summary

```
SalesAgent ──(owns)──▶ Carrier ──(assigned to)──▶ Dispatcher
                          │
                          ├──(has many)──▶ FollowUp
                          │
                          └──(has many)──▶ Load ──(booked by)──▶ Dispatcher
```

### 4.2 Table: `sales_agents`

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| real_name | text | e.g. "Shoaib Jameel" |
| alias | text | Codename used with US clients, e.g. "Shawn Brown" |
| monthly_target | int | Number of carriers expected per month |
| is_active | bool | For agents who have left |

### 4.3 Table: `dispatchers`

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| real_name | text | e.g. "Zaheeb Akram" |
| alias | text | e.g. "Zac Carter" |
| monthly_target | decimal | Dollar target per month *(both roles use monthly targets)* |
| is_active | bool | |

### 4.4 Table: `carriers` — **the core table; one row = one "sale"**

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| company_name | text | e.g. "ALVARO M DELGADILLO" |
| contact_person | text | |
| phone | text | |
| email | text | |
| mc_number | text | Motor Carrier authority number |
| mc_age | text | How old the authority is, e.g. "8M", "2M 1W" |
| truck_type | enum | SD, SBT, SBT/DV, PO, DV — *list to be expanded, see open items* |
| sales_agent_id | FK → sales_agents | **Owner. IMMUTABLE — a carrier permanently belongs to the agent who signed it and is never reassigned.** Drives the sales-agent access filter. |
| status | enum | See lifecycle below |
| status_changed_at | timestamp | Auto-stamped whenever status changes |
| docs_sent_at | date | When the agreement was sent to the carrier |
| docs_received_at | date | When the signed agreement came back |
| dispatcher_id | FK → dispatchers | Nullable until assigned |
| date_assigned | date | |
| first_load_delivered_at | date | **The moment the carrier becomes Active.** Derived from the Loads table |
| lead_source | text | Cold call, referral, etc. |
| remarks | text | |

#### 4.4.1 Carrier status lifecycle

This is the heart of the system. The status moves through these stages:

| Status | Meaning | Who/what sets it |
|---|---|---|
| **Lead** | Contacted, conversation in progress | Sales Agent |
| **Documents Sent** | Agreement sent to the carrier, awaiting signature | Sales Agent |
| **Documents Received** | Carrier signed and returned the agreement | Sales Agent |
| **Signed — Awaiting First Load** | Docs are in, dispatcher assigned, but no load delivered yet | System (on dispatcher assignment) |
| **Active** | Carrier has accepted **and delivered** at least one load | **System — computed automatically** |
| **No Agreement** | Carrier declined to sign | Sales Agent |
| **Dead** | Carrier disengaged at any stage | Sales Agent or Admin |

**Two rules that follow from this:**

1. **`Active` is a computed status, not a manual one.** A carrier is Active the moment a Load linked to it reaches `load_status = Delivered`. No human sets this. This prevents the common data problem of a carrier being marked "Active" optimistically when nothing has actually shipped.

2. **The handoff boundary is explicit.** The Sales Agent's job ends at `Documents Received`. The Dispatcher's job is what converts a signed carrier into an Active one. `Signed — Awaiting First Load` is the state where the sale sits *between* the two teams.

#### 4.4.2 The stalled-sale metric *(new capability)*

Because `Signed — Awaiting First Load` is its own explicit state, the system can now answer a question the current spreadsheets cannot:

> **How many carriers signed our agreement but never delivered a single load?**

These are sales that were *made* but never *realized*. Tracking the time a carrier spends in this state — and who the assigned dispatcher was — surfaces whether the bottleneck is sales bringing in unsuitable carriers, or dispatch failing to service them. This should be a headline metric on the Admin dashboard.

### 4.5 Table: `carrier_status_history` — *(new; enables "what happened to the sale")*

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| carrier_id | FK → carriers | |
| old_status | enum | |
| new_status | enum | |
| changed_at | timestamp | |
| changed_by | FK → users | |
| reason | text | Why it changed |

This gives a full audit trail of every sale's journey, which a single `status` field cannot.

### 4.6 Table: `follow_ups` — *(new; the biggest current gap)*

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| carrier_id | FK → carriers | |
| sales_agent_id | FK → sales_agents | Who made the contact |
| contacted_at | datetime | |
| type | enum | Call, Text, Email, In-person |
| notes | text | What was discussed |
| outcome | enum | Interested, Not interested, Callback later, Signed, Went dead |
| next_followup_date | date | Drives a "who's due today" view |

**Derived metrics available for free from this table:**
- Total follow-ups per carrier
- Days since last follow-up
- Average number of follow-ups before a carrier signs
- Average number of follow-ups before a carrier goes dead
- Which agents follow up consistently and which don't

### 4.7 Table: `loads` — *(dispatch strength data)*

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| carrier_id | FK → carriers | |
| dispatcher_id | FK → dispatchers | |
| pickup_date | date | |
| pickup_location | text | City, State |
| delivery_date | date | |
| delivery_location | text | City, State |
| rate | decimal | What the load pays |
| service_charge_pct | decimal | Company's commission %, e.g. 0.04 |
| amount_earned | computed | rate × service_charge_pct |
| payment_status | enum | Paid, Invoice Created, Pending |
| payment_route | text | Zelle, etc. |
| load_status | enum | En Route, Delivered |
| remarks | text | |

**Derived insights available for free from this table:**
- Most profitable lanes (pickup → delivery pairs)
- Average rate by dispatcher
- Which carriers generate the most revenue
- Payment collection rate and outstanding invoices

### 4.8 Table: `users` (auth)

| Field | Type | Notes |
|---|---|---|
| id | PK | |
| email | text | Login |
| password_hash | text | |
| role | enum | sales_agent, dispatcher, admin |
| linked_agent_id | FK → sales_agents | Nullable |
| linked_dispatcher_id | FK → dispatchers | Nullable |

---

## 5. Key Workflows

### 5.1 The sales stage (Sales Agent owns this)
1. Sales Agent creates a Carrier record with status = `Lead`.
2. Agent logs Follow-ups against that carrier over time.
3. Agent sends the agreement → status = `Documents Sent`, `docs_sent_at` stamped.
4. Carrier signs and returns it → status = `Documents Received`, `docs_received_at` stamped.
5. If the carrier declines → `No Agreement`. If they disengage → `Dead`.

**The Sales Agent's job ends here.** They cannot mark a carrier Active.

### 5.2 The handoff (Admin or system)
1. On `Documents Received`, a Dispatcher is assigned (`dispatcher_id` set).
2. Status automatically becomes `Signed — Awaiting First Load`.
3. The carrier now appears in that Dispatcher's queue.

### 5.3 The dispatch stage (Dispatcher owns this)
1. Dispatcher creates a Load, linked to the Carrier.
2. `amount_earned` calculates automatically from rate × service charge %.
3. Load status moves `En Route` → `Delivered`.
4. **On the first Load reaching `Delivered`, the system automatically flips the Carrier to `Active`** and stamps `first_load_delivered_at`. This is the only way a carrier becomes Active.
5. Payment status moves `Pending` → `Invoice Created` → `Paid`.

### 5.4 Target tracking (fully automatic, monthly for both roles)
- **Sales Agent progress** = count of Carriers where `sales_agent_id = me` and `docs_received_at` falls in the current month. *(Credit is earned on getting documents signed — the part the agent actually controls.)*
- **Dispatcher progress** = sum of `amount_earned` on Loads where `dispatcher_id = me` and the load falls in the current month.
- Both targets are set **per month**.
- **Nothing is manually totalled.**

---

## 6. Reports / Dashboards

### 6.1 Sales Agent dashboard
- My carriers (filterable by status)
- My follow-ups due today / overdue
- My target vs actual for this month

### 6.2 Dispatcher dashboard
- My assigned carriers
- My loads (En Route vs Delivered)
- My target vs actual for this week
- Outstanding/unpaid loads

### 6.3 Admin dashboard
- All agents: target vs actual, carriers signed, conversion rate
- All dispatchers: target vs actual, loads booked, revenue earned
- Pipeline view: how many carriers at each status (Lead → Documents Sent → Documents Received → Awaiting First Load → Active)
- **Stalled sales report *(headline metric)*:** carriers stuck in `Signed — Awaiting First Load` — how many, for how long, and under which dispatcher. This is where sales and dispatch hand off, and where value leaks.
- **Dispatch strength report:** top lanes, average rate by lane, best-performing carriers
- **Follow-up health:** carriers with no contact in X days; average follow-ups to close

---

## 7. Migration Path

### Phase 1 — Google Sheets prototype *(current)*
Prove the data model works. Six tabs mirroring the six tables, with lookup formulas replacing duplicate typing, and `QUERY` formulas producing per-agent filtered views. Access control via Google Sheets protected ranges.

**Known limitations of this phase:** protected ranges are fragile at scale; no real login per user; formulas break easily on manual edits. This phase is for validating the *structure*, not for long-term operation.

### Phase 2 — Web app + database *(target)*
The six tabs become six database tables with no redesign required. Add:
- Real user authentication with roles
- Row-level access control (enforced server-side, not by hiding tabs)
- Forms for data entry instead of raw grids
- Automatic timestamping (`status_changed_at`, follow-up dates)
- Dashboards and reports

**The data model in section 4 is designed to carry over unchanged between phases.**

---

## 8. Decisions Log

These questions were raised in v1.0 and have now been answered by the business.

| # | Question | Decision |
|---|---|---|
| 1 | Are the carrier status values complete? | **No — two stages were missing.** `Documents Sent` and `Documents Received` have been added to the lifecycle. See §4.4.1. |
| 2 | Should the truck type list be expanded? | **Yes.** *(Exact list still to be provided — see remaining items below.)* |
| 3 | When does a sale become "Active"? | **Only when a load has been accepted AND delivered.** Sales gets the documents signed; Dispatch converts that into an Active carrier by delivering a load. `Active` is therefore a **system-computed status**, never set by hand. See §4.4.1. |
| 4 | Can a carrier be reassigned to a different sales agent? | **No.** A carrier permanently belongs to the agent who signed it. `sales_agent_id` is immutable. |
| 5 | What period are targets set for? | **Monthly, for both Sales Agents and Dispatchers.** |
| 6 | Should the system handle commission/payout? | **No.** Payouts are handled separately, outside this system. Confirmed out of scope. |

---

## 8b. Remaining Open Items

1. **Truck type list** — confirmed it needs expanding, but the full list is still needed. Current known values: SD, SBT, SBT/DV, PO, DV. What else?
2. **Who assigns the dispatcher?** On `Documents Received`, does an Admin manually pick the dispatcher, or is there a rule (round-robin, by truck type, by workload)?
3. **Can a Dispatcher log follow-ups?** Follow-ups are currently modelled as sales-side only. If dispatchers also need to log contact with their carriers, the `follow_ups` table needs a role field.
4. **Is there a time limit on `Signed — Awaiting First Load`?** E.g. if a carrier signs but delivers nothing for 60 days, should it auto-flag or auto-move to Dead?

---

## 9. Success Criteria

The CRM is working if:

- No piece of information (carrier name, agent name, dispatcher name) is ever typed in more than one place.
- Any carrier's complete history — every follow-up, every status change, every load — can be seen on one screen.
- A sales agent cannot see another agent's carriers.
- Every target figure on every dashboard is calculated, never manually entered.
- **No human can mark a carrier `Active`.** It happens only when a load is delivered.
- The question *"why did this carrier go dead, and how many times did we try?"* has an answer in the system.
- The question *"how many carriers signed but never shipped anything?"* has an answer in the system.
