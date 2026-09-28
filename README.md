<div align="center">

<img src=".github/assets/cover.png" alt="Freightly" width="100%">

# Freightly

**Dispatch CRM for a truck-dispatching company: sales pipeline, carriers, loads, and team targets in one place.**

<p>
<a href="https://unisole-crm.vercel.app"><img alt="Live" src="https://img.shields.io/badge/Live-open%20%E2%86%97-c8f560?style=for-the-badge&labelColor=0b0c10"></a>
<a href="https://ibiraheel.com/p/freightly"><img alt="Case study" src="https://img.shields.io/badge/Case%20study-ibiraheel.com-0b0c10?style=for-the-badge&labelColor=c8f560"></a>
</p>

<p>
<img alt="Next.js" src="https://img.shields.io/badge/Next.js-000000?style=flat-square&logo=nextdotjs&logoColor=white">
<img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?style=flat-square&logo=typescript&logoColor=white">
<img alt="Supabase" src="https://img.shields.io/badge/Supabase-3FCF8E?style=flat-square&logo=supabase&logoColor=white">
<img alt="Postgres RLS" src="https://img.shields.io/badge/Postgres%20RLS-4169E1?style=flat-square&logo=postgresql&logoColor=white">
<img alt="Tailwind" src="https://img.shields.io/badge/Tailwind-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white">
<img alt="Vercel" src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white">
<img alt="Claude Code" src="https://img.shields.io/badge/Claude%20Code-D97757?style=flat-square&logo=claude&logoColor=white">
</p>

</div>

<br>

> **Spreadsheets to a live CRM**  
> for UniSole IT Hub, a truck-dispatch business with sales agents and dispatchers

## What it did

Working MVP with auth, carriers, loads, dashboards, team targets, and row-level security, running on Supabase and deployed on Vercel.

<sub>Outcome: reported by the owner.</sub>

## How it works

<p align="center"><img src=".github/assets/architecture.svg" alt="Architecture" width="100%"></p>

1. Next.js App Router with server actions; no separate API service to run.
2. Supabase Postgres with row-level security so agents and dispatchers only see their own book.
3. Fourteen ordered SQL migrations plus a simulation script that seeds and clears [SIM] demo rows.
4. Product defined first: PRD, design doc, and roadmap live in the repo and drove the build.

## Run it locally

```bash
cp .env.local.example .env.local   # Supabase URL + anon key (+ service role for admin logins)
# apply the schema: paste supabase/apply_all.sql into the Supabase SQL editor
npm install
npm run dev                          # http://localhost:3000
```

## Repository layout

```
├── app/
│   ├── (app)/
│   ├── api/
│   ├── login/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── AgentAssigner.tsx
│   ├── CarrierFilters.tsx
│   ├── CarrierForm.tsx
│   ├── DispatcherAssigner.tsx
│   ├── DispatchNoteModal.tsx
│   ├── EditCarrierForm.tsx
│   ├── FollowUpModal.tsx
│   ├── icons.tsx
│   ├── LeadImportForm.tsx
│   ├── LifecycleStrip.tsx
│   ├── LoadAmountEditor.tsx
│   ├── LoadFilters.tsx
│   ├── LoadForm.tsx
│   └── LoadsFlowMap.tsx
│   └── … 14 more
├── lib/
│   ├── actions/
│   ├── supabase/
│   ├── auth.ts
│   ├── presence.ts
│   ├── status.ts
│   └── usStates.ts
├── supabase/
│   ├── migrations/
│   ├── apply_all.sql
│   ├── README.md
│   └── seed.sql
├── CLAUDE.md
├── middleware.ts
├── next.config.mjs
├── package.json
├── ROADMAP.md
├── simulation.mjs
├── tsconfig.json
├── UniSole_CRM_Design.md
├── UniSole_CRM_PRD.md
└── vercel.json
```

---

<div align="center">

<sub>Built by <a href="https://github.com/ibi-raheel">Muhammad Ibrahim Raheel</a> · more work at <a href="https://ibiraheel.com">ibiraheel.com</a></sub>

</div>
