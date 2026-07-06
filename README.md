# 🌿 GreenMap

AI-powered farm management and harvest transparency for Malaysian smallholder farmers.
Built for the **Codex Community Hackathon KL 2026** ("AI for Malaysia").

Growers map their farm from a bird's-eye view, track every plant's health with AI scans,
and generate a **Harvest Passport** — a QR code consumers scan to see the full growing journey.
The Map tab also becomes a full desktop dashboard on wider screens, with live weather
(temperature, rain, soil moisture) for daily watering decisions.

## Repository layout

- **[`greenmap/`](greenmap/)** — the Next.js 15 app (the product). **Start here:** [`greenmap/README.md`](greenmap/README.md).
- **[`skills-updated/`](skills-updated/)** — Cowork AI advisor skills for this project (business model, data/AI logic, technical architecture).
- **`farm-map-dashboard.html`** — an early static prototype.

## Quick start

```bash
cd greenmap
npm install
cp .env.example .env.local   # fill in Supabase URL + anon key (Gemini key optional)
npm run dev                  # → http://localhost:3000
```

Full setup, environment variables, and a feature tour are in [`greenmap/README.md`](greenmap/README.md).
Build plan and backend reference live in [`greenmap/docs/`](greenmap/docs).

> **Note:** `.env.local` (your real API keys) is git-ignored and never committed — only the blank `.env.example` template is tracked.
