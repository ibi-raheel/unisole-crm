# CLAUDE.md — UniSole Dispatch CRM

## What this project is

A CRM for **UniSole IT Hub LLC**, a truck dispatching company.

The business has two teams:
- **Sales agents** find trucking companies ("carriers") and get them to sign an agreement.
- **Dispatchers** are then assigned to those carriers, and book freight loads for them.
  The company earns a percentage service charge on each load.

The company currently runs on four disconnected Google Sheets. This project replaces them.

## Source of truth — read these first

| File | Contains |
|---|---|
| `UniSole_CRM_PRD.md` | Requirements, data model, business rules, status lifecycle |
| `UniSole_CRM_Design.md` | UI design, colour scheme, and performance constraints |

**Read both before doing any work.** They override any assumption you would otherwise make.
If something in this file appears to conflict with the PRD, the PRD wins — but tell me about
the conflict rather than silently picking one.

---

## Non-negotiable business rules

These came directly from the business owner. Getting any of them wrong means the system is wrong.

1. **`Active` is computed, never set by hand.**
   A carrier becomes `Active` only when one of its loads reaches `load_status = 'Delivered'`.
   No human — not even an admin — can mark a carrier Active manually.
   **Enforce this at the database level**, not in application code.

2. **A carrier's sales agent never changes.**
   `sales_agent_id` is immutable. A carrier permanently belongs to the agent who signed it.
   **Enforce this at the database level.**

3. **Every status change is recorded automatically.**
   Each change writes a row to `carrier_status_history`, via a database trigger, so it cannot
   be skipped or bypassed by any code path.

4. **The carrier status lifecycle is:**
   ```
   Lead → Documents Sent → Documents Received → Signed (Awaiting First Load) → Active
   ```
   With `Dead` and `No Agreement` as exits from any stage. See PRD §4.4.1.

5. **`Signed — Awaiting First Load` is the headline metric.**
   These are carriers that signed but never shipped anything — sales that were made but never
   realised. The business must be able to ask, instantly: *which carriers are stuck here, for
   how long, and under which dispatcher?*

6. **Targets are monthly** for both sales agents and dispatchers.

---

## Access rules

- A **sales agent** sees only their own carriers and follow-ups.
- A **dispatcher** sees only carriers assigned to them, and loads they booked.
- An **admin** sees everything.

Access is enforced **server-side**, based on the logged-in user. Never by hiding things in the UI.

---

## Technical constraints

**The internet in Pakistan is slow. This is an architectural constraint, not a preference.**

Users sit in this tool all day doing data entry. Every unnecessary kilobyte is paid for
repeatedly, by every user, all day.

- **Server-rendered HTML.** Not a heavy SPA framework. A React/Next.js bundle ships 200KB–1MB
  of JavaScript before a single row of data appears — the wrong trade for this use case.
- For interactivity, prefer something tiny like **HTMX (~14KB)** or **Alpine.js (~15KB)**.
- **No web fonts.** Use the system font stack. Saves 100–300KB.
- **Under 150KB per page. Usable on 3G.**
- Paginate everything. No infinite scroll.

Full detail in `UniSole_CRM_Design.md` §3.

---

## Design

- **Purple and white.** Palette is in `UniSole_CRM_Design.md` §4.
- Minimal, dense, and fast. This is a **tool**, not a website — closer to a well-organised
  spreadsheet than to a landing page.
- **One exception to the purple palette:** carrier status badges use their own colours
  (green = Active, red = Dead, amber = stalled). Status must be glanceable, and seven shades
  of purple would be indistinguishable. Nothing else in the app uses non-purple colour.

---

## How to work with me

**Plan before building.** For anything non-trivial, show me the plan and wait for approval
before writing code or creating files.

**Ask when the PRD is ambiguous.** Do not guess and proceed. I would rather answer a question
than unpick a wrong assumption later.

**I am not a developer.** Explain things in plain language. When you propose something,
tell me what it means for the business, not just what it means technically.

---

## Known open items

These are not yet decided. Ask before assuming:

1. The full list of truck types (current known values: SD, SBT, SBT/DV, PO, DV — more exist).
2. Who assigns the dispatcher when documents are received — an admin manually, or by a rule?
3. Whether dispatchers can log follow-ups, or whether follow-ups are sales-only.
4. Whether a carrier stuck in `Signed — Awaiting First Load` should auto-flag after N days.
