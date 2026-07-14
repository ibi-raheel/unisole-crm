# UniSole CRM — Design Document

**Version:** 1.0
**Companion to:** `UniSole_CRM_PRD.md` (v2.0)
**Scope:** Visual design, UI patterns, and the performance constraints that shape them

---

## 1. The brief, and what actually drives it

Three requirements were given:

1. **Lightweight** — internet in Pakistan is slow
2. **Minimal, easy to understand and navigate**
3. **Purple and white**

Of these, **#1 is not a styling preference — it is an architectural constraint.** A CRM is not a page people visit once. It is a tool that sales agents and dispatchers sit inside for eight hours a day, loading and saving records constantly. On a slow connection, every unnecessary kilobyte is paid for *repeatedly*, all day, by every user.

So the design principle below overrides every aesthetic instinct in this document:

> **Nothing loads that doesn't earn its bandwidth.**

Requirements #2 and #3 are then free to be beautiful — they just have to be beautiful *within the budget*.

---

## 2. Who is using this, and how

This matters, because it makes the design decisions obvious.

| | Reality |
|---|---|
| **Users** | Sales agents and dispatchers in Lahore, working US freight lanes |
| **Usage pattern** | All-day, high-frequency data entry. Not casual browsing. |
| **Primary actions** | Log a follow-up. Add a load. Update a status. Check a target. |
| **What they need** | Speed and clarity. Get in, log the thing, get out. |
| **What they do not need** | Hero images. Animations. Marketing polish. Onboarding tours. |

**Design consequence:** this is a *tool*, not a *website*. It should feel closer to a well-organized spreadsheet than to a landing page. Its beauty comes from clarity, density, and speed — not from decoration.

---

## 3. Performance budget

These are hard limits, not aspirations.

| Asset | Budget | How |
|---|---|---|
| **Web fonts** | **0 KB** | Use the system font stack. No Google Fonts, no custom faces. This alone saves 100–300 KB per user. |
| **Images / icons** | **Near 0 KB** | No image files. Icons drawn as inline SVG (a few hundred bytes each) or omitted entirely. |
| **CSS** | **< 20 KB** | Hand-written. No Bootstrap, no Tailwind CDN build. |
| **JavaScript** | **< 50 KB** | See §3.1 — most pages should need almost none. |
| **Initial page load** | **< 150 KB total** | Should be usable on a 3G connection. |
| **Time to interactive** | **< 2 seconds on 3G** | The test that matters. |

### 3.1 The most important technical decision

**Server-rendered HTML, not a heavy single-page-app framework.**

A React/Next.js SPA ships 200KB–1MB of JavaScript before the user sees a single row of data. For a data-entry tool on a slow connection, this is the wrong trade. Plain server-rendered pages (Django, Rails, Laravel, or Go templates) send HTML that renders instantly.

Where interactivity is genuinely needed (inline edits, live search, filtering without a page reload), use a lightweight library like **HTMX (~14 KB)** or **Alpine.js (~15 KB)** rather than a full framework. These give 90% of the interactivity for 5% of the bandwidth.

### 3.2 Other bandwidth rules

- **Paginate everything.** 50 rows per page. Never load 5,000 carriers at once.
- **No infinite scroll.** It forces repeated requests. Use explicit page numbers.
- **Cache aggressively.** Dropdown lists (agents, dispatchers, truck types) change rarely — cache them.
- **Autosave drafts locally.** If a dispatcher loses connection halfway through entering a load, the form should not vanish. Save to `localStorage` as they type.
- **Optimistic UI on save.** Show the row as saved immediately, reconcile with the server in the background. On a slow connection, waiting 4 seconds for a spinner after every follow-up is what makes a tool hated.

---

## 4. Color

Purple and white, as specified. The palette is deliberately small.

### 4.1 Core palette

| Name | Hex | Use |
|---|---|---|
| **Purple 900** | `#2E1F5E` | Headings, primary text on white |
| **Purple 700** | `#4A32A8` | **Primary brand.** Buttons, active nav, links |
| **Purple 500** | `#6D55C9` | Hover states, secondary emphasis |
| **Purple 100** | `#EDE9F9` | Row hover, selected states, subtle fills |
| **Purple 50** | `#F7F5FD` | Page background (barely tinted, not pure white) |
| **White** | `#FFFFFF` | Cards, tables, forms — the working surface |
| **Gray 600** | `#5C5A66` | Secondary text, labels, captions |
| **Gray 200** | `#E4E2EA` | Borders, dividers, table rules |

**Note on the background:** the page background is `Purple 50`, not pure white, and content cards sit on `White`. This creates gentle separation without needing shadows or borders — one less thing to render, and it makes the working surface feel lifted.

### 4.2 The status color problem

This is the one place where a purple-only palette breaks down, and it needs a deliberate answer.

The carrier lifecycle has **seven statuses** (Lead, Documents Sent, Documents Received, Signed–Awaiting First Load, Active, No Agreement, Dead). Seven shades of purple would be indistinguishable at a glance — and *glanceability is the entire point of a status field*.

**The solution: purple carries the brand; status carries meaning.**

Status badges are the *only* place non-purple color is permitted anywhere in the app. This is not a violation of the brief — it's what makes the purple mean something. When color is used everywhere, it signals nothing.

| Status | Color | Hex | Reasoning |
|---|---|---|---|
| Lead | Gray | `#6B7280` | Nothing has happened yet |
| Documents Sent | Amber | `#B45309` | Waiting on someone else |
| Documents Received | Blue | `#1D4ED8` | Progress, in motion |
| Signed — Awaiting First Load | **Amber, outlined** | `#B45309` | **Deliberately uncomfortable.** This is the stalled state from the PRD. It should feel unfinished. |
| Active | Green | `#15803D` | The goal state |
| No Agreement | Gray, muted | `#9CA3AF` | Closed, neutral |
| Dead | Red, muted | `#B91C1C` | Closed, negative |

Badges are small, low-saturation, and text-led (colored text on a pale tint of the same hue) — never large blocks of solid color. The screen should still read as purple-and-white overall, with these functioning as small signal lights.

---

## 5. Typography

**No web fonts.** This is the single biggest performance win available, and it costs almost nothing aesthetically for a tool of this kind.

```css
font-family: system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
```

This renders as Segoe UI on Windows (which is what the team is using), San Francisco on Mac, Roboto on Android. All are clean, highly legible, and already on the device — **0 KB, instant render**.

### 5.1 Type scale

Deliberately tight. A dense tool doesn't need eight heading levels.

| Role | Size | Weight | Use |
|---|---|---|---|
| Page title | 24px | 600 | One per page. "Carriers", "My Follow-ups" |
| Section heading | 18px | 600 | Card headers |
| Body / table text | 14px | 400 | The workhorse. Everything in tables. |
| Label / caption | 12px | 500 | Form labels, table headers, badges |
| Numbers (money, targets) | 14px | 500, **tabular** | `font-variant-numeric: tabular-nums` |

**On tabular numbers:** this is a small detail that matters a lot here. It forces every digit to the same width, so a column of dollar amounts aligns perfectly down the page. In a system full of rates and targets, misaligned numbers are genuinely harder to scan. One CSS line, real payoff.

---

## 6. Layout

### 6.1 Overall shell

```
┌──────────────────────────────────────────────────┐
│  UniSole            [Carriers ▾] [Loads]   Asim ▾│  ← 48px bar, Purple 700
├──────────────────────────────────────────────────┤
│                                                  │
│   Carriers                        [+ Add carrier]│  ← page title + primary action
│   ┌────────────────────────────────────────────┐ │
│   │ [Search......]  [Status ▾]  [Agent ▾]      │ │  ← filters, always visible
│   ├────────────────────────────────────────────┤ │
│   │ Company          Status      Agent   Last  │ │
│   │ ALVARO M DEL...  ● Active    Atif    2d    │ │
│   │ JAMES SACKEY     ● Docs Sent Atif    9d    │ │  ← 14px rows, hover = Purple 100
│   │ JENNY MUSAC      ● Dead      Atif    31d   │ │
│   └────────────────────────────────────────────┘ │
│                            ‹ 1 2 3 ›             │  ← explicit pagination
└──────────────────────────────────────────────────┘
```

**A single top bar. No sidebar.** A sidebar costs 200+ horizontal pixels permanently, and this app has only four or five destinations. A horizontal nav is enough, and it gives tables the full width they need.

### 6.2 The one signature element: the carrier timeline

Every carrier detail page leads with a **horizontal lifecycle strip** — the sale's journey, at a glance:

```
  Lead ──▶ Docs Sent ──▶ Docs Received ──▶ Awaiting Load ──▶ Active
   ✓          ✓              ✓                 ● 14 days
  Jun 2      Jun 9          Jun 14            (stalled)
```

Completed stages are filled in `Purple 700`. The current stage pulses gently in its status color. Future stages are hollow `Gray 200`.

**Why this is the signature:** the PRD's central insight is that a sale has a *journey*, and that the business currently can't see where sales get stuck. This strip makes that journey the first thing you see on every carrier — and it makes a stalled sale visually obvious. It's the one place worth spending design effort, because it's the one thing the old spreadsheets fundamentally could not do.

It costs nothing to render: it's just divs and borders. No images, no JS.

### 6.3 Density

Tables are **compact** — 36px row height, not the 56px that's fashionable. Users are scanning dozens of carriers, not admiring them. Comfortable density beats airy whitespace when the job is finding a record fast.

---

## 7. Key screens

| Screen | Who | Contains |
|---|---|---|
| **Login** | All | Email + password. Nothing else. |
| **My Dashboard** | Sales Agent | Target vs actual (one number, big). Follow-ups due today. Recently updated carriers. |
| **Carriers list** | Sales Agent (own) / Admin (all) | Filterable, searchable table. |
| **Carrier detail** | Both | Lifecycle strip (§6.2), details, follow-up history, loads. |
| **Log follow-up** | Sales Agent | A small modal, not a page. Four fields. Should take 10 seconds. |
| **Loads list** | Dispatcher / Admin | Filterable table. |
| **Add load** | Dispatcher | Form. Amount earned auto-calculates as they type the rate. |
| **Admin dashboard** | Admin | All agents/dispatchers vs targets. **Stalled sales report** (headline). Pipeline counts. |

### 7.1 The follow-up modal deserves special attention

This is the single most-used interaction in the entire system. If logging a follow-up is slow or annoying, agents won't do it — and the follow-up data is the whole point of the CRM.

It must be: **one click to open, four fields, keyboard-navigable, one click to save, and it must never lose data on a dropped connection.** Optimize this screen above all others.

---

## 8. Writing / interface copy

- **Sentence case everywhere.** "Add carrier", not "Add Carrier".
- **Name things by what the user does**, not by how the database is built. "Log a follow-up", not "Create FollowUp record".
- **Buttons say what happens.** "Save follow-up" → toast says "Follow-up saved."
- **Empty states are invitations, not apologies.** An empty follow-up list says *"No follow-ups logged yet. Log the first one →"*, not *"No data available."*
- **Errors say what to do.** *"Pick a carrier before saving."* not *"Validation error: carrier_id required."*

---

## 9. Accessibility floor

Non-negotiable, and cheap to do:

- Every interactive element reachable by keyboard, with a visible focus ring (`Purple 500`, 2px).
- Status is **never communicated by color alone** — every badge has a text label. (Critical: roughly 1 in 12 men has some form of color blindness, and this is a male-dominated team.)
- Text contrast meets WCAG AA. `Purple 700` on white passes comfortably.
- Forms have real `<label>` elements, not placeholder text pretending to be labels.

---

## 10. What this design deliberately does not have

Stating these explicitly, so they don't creep back in:

- ❌ No hero images or illustrations
- ❌ No web fonts
- ❌ No animation beyond a hover state and the lifecycle strip's gentle pulse
- ❌ No gradients, shadows, or glass effects
- ❌ No dark mode in v1 (adds work, users are in a lit office)
- ❌ No mobile app (responsive web is enough; nobody enters loads on a phone)
- ❌ No dashboard charts in v1 — a well-formatted number is faster to read and 100× cheaper to load than a charting library

**Every one of these is a bandwidth decision as much as an aesthetic one.**
