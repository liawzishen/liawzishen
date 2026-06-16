# Backend Doc Structure (`docs/03_BACKEND_TRUTH.md`)

> Per decision **D7**, GreenMap's canonical backend doc is `docs/03_BACKEND_TRUTH.md` (there is no separate `05`). The built **code** is the ultimate source of truth — keep this doc in sync with it.

When the user confirms all backend decisions (after Steps 1–9), update `docs/03_BACKEND_TRUTH.md` using this structure:

```
# 03 — GreenMap Backend Truth
> Canonical backend reference for the build · Kept in sync with the code

---

## 1. Purpose of This Document
[Why this document exists. What it covers. How it relates to other project files.]

## 2. Architecture Overview
[Next.js + Supabase mental model. What talks to what. Diagram of data flow.]

## 3. Technology Stack
[Full stack table with tool, purpose, cost, and rationale for each choice.]

## 4. MVP Backend Scope
[What is included now (8 tables, 7 API routes, 3 buckets).
 What is Phase 2. What is Phase 3. Explicit "do NOT build" list.]

## 5. Supabase Database Relationship Overview
[Simple language relationships. Table dependency chain. Visual diagram if helpful.]

## 6. Final MVP Table Schema
[Full field-by-field definition for all 8 tables.
 Include types, required/optional, defaults, constraints, notes.]

## 7. Data Calculation Rules
[Health score formula with all sub-scores.
 Trust badge calculation rules with data sources.
 Severity → sub-score mapping.
 Watering and fertilizer decay formulas.]

## 8. AI Scan Backend Flow
[Step-by-step: upload → Gemini → validate → grower confirms → save.
 Include the Gemini prompt structure.
 Include validation rules (JSON parse, severity enum, confidence clamp).
 Include fallback behavior on failure.]

## 9. Health Score Backend Flow
[When recalculation triggers. Where the formula runs.
 Passive decay display vs stored score.
 Health score history snapshot writes.
 How Farm Map and Plant Detail stay consistent.]

## 10. Harvest Passport Backend Flow
[Step-by-step: mark as harvested → calculate → snapshot → QR token.
 Include all fields that are pre-calculated.
 Include trust badge generation logic.]

## 11. Supabase Storage Design
[Three buckets. Contents. Access rules. Upload flow.]

## 12. RLS and Security Rules
[Full SQL for all RLS policies.
 Explain the farm ownership chain.
 Explain public passport access.
 Explain server-side service role usage for QR page.]

## 13. Next.js API Routes
[Table: route, method, purpose, inputs, outputs.
 Explain what uses Supabase direct vs API routes.
 Include environment variable usage per route.]

## 14. Frontend Data Fetching Strategy
[Which pages are server components vs client components.
 Which queries use Supabase client SDK vs server SDK.
 React Context usage for farm setup and farm context.
 Session caching for AI suggestions.]

## 15. MVP vs Phase 2 / Phase 3 Backend Features
[Three-column table: MVP | Phase 2 | Phase 3.
 Explicit and complete.]

## 16. Build Order
[4-week timeline with weekly milestones.
 Daily task breakdown.
 Risk buffer notes.]

## 17. Final Backend Checklist
[Checklist of everything that must be true before demo:
 - All 8 tables created with RLS
 - All 7 API routes working
 - All 3 storage buckets created
 - Seed script produces demo data
 - AI scan works with pre-tested photos
 - Health score updates on all trigger events
 - Harvest Passport generates correctly
 - QR page loads publicly without login
 - Environment variables set on Vercel]

---

*GreenMap · Backend Truth (docs/03) · kept in sync with the code*
*Codex Community Hackathon KL 2026 · AI for Malaysia 🇲🇾*
```

Important: include the document version note and hackathon context label at the bottom, matching the style of other GreenMap documents.
