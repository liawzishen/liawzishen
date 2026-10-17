# 🌿 GreenMap

**Farm management and harvest transparency for Malaysian smallholder farmers, with AI plant checks and a QR "Harvest Passport" for buyers.**

> *From seed to table. Every step recorded, every plant verified, every harvest trusted.*

A grower records each plant's life on a simple farm map. At harvest, GreenMap creates a **Harvest Passport**: a QR code that any buyer can scan with a phone camera to see how the food was grown.

**Jump to:** [How to use it](#how-to-use-it) · [Demo accounts](#try-it-demo-accounts) · [Why it's good](#why-its-good) · [What's real and what's a preview](#whats-real-and-whats-a-preview) · [Run it locally](#run-it-locally) · [Developer guide](greenmap/README.md)

## The problem

| Who | The problem today |
|---|---|
| **Buyers in Malaysia** | They have no way to check how their food was grown. |
| **Smallholder farmers** | They have no easy, visual tool to manage their farm. |

GreenMap joins the two sides. The grower's daily records become the buyer's proof. The build plan calls this core path "never cut":

```
Farm → Plant → AI scan → Harvest → Passport QR
```

The buyer then scans the QR. Care logs feed the health score and the passport story along the way.

## What it does

| For growers | For buyers |
|---|---|
| A bird's-eye map of the farm, with each plant as a coloured marker | Scan a QR code. No app or account needed. |
| A daily task list built from real care dates | See the full growing story, from planting to harvest |
| A 0–100 health score for every plant | See the trust badges the grower has earned |
| AI leaf scans and next-step tips (Google Gemini) | Share the passport on WhatsApp |
| Local weather and watering advice | Browse a market and get help with orders *(preview)* |
| A Harvest Passport QR code at harvest time | |

## How to use it

### Grower journey

The grower app has four tabs (**Home**, **Map**, **Sales**, **Profile**) and a round **AI Scan** button in the middle.

1. **Sign up.** On the landing page, tap **Get Started**. Choose **Grower** ("I manage a farm"), then **Create Account**, or **Sign In** with the demo account.
2. **Set up your farm (once).** Follow 3 steps: **Farm Profile** (name, state, size, main crop, optional **📍 Pin my farm's GPS location**), **Choose Your Map** (**Smart Background**, **Upload Photo** or **Satellite View**) and **Almost Done!** (optional zones). Tap **Enter My Farm** (or **Skip & Enter My Farm**).
   *Why it helps:* the map looks like your field, and the GPS pin gives weather for your exact farm.
3. **Add your plants.** Open **Map**, tap **＋**, tap the spot where the plant is, and fill in **Add Plant**. A grey **New** marker appears.
4. **Start the morning on Home.** Read the watering advice, for example "Rain expected today" or "Soil is drying out". Open **Today's Tasks** (*Ready to Harvest*, *Needs Watering*, *Needs Fertilizing*). Tap a plant to mark it done, or tap **Water All** / **Fertilize All**. Made a mistake? Undo it in **✅ Completed Today**.
   *Why it helps:* no planning needed. Tasks come from your real care dates (water 3 days after the last watering, fertilize 14 days after the last feed; new plants show up after 2 and 7 days), and each row says why, for example "Last watered 4d ago".
5. **Check a plant.** On **Map**, tap a marker to log **Water**, **Fertilize** or a **Note**. Tap **View More Details** to see the **Health Score**, **7-Day Trend** and **AI Suggestion**. Use **Set Status** (Healthy / Attention / Critical) to add your own view. Tap **Need Care** on the map to show only plants that need you.
6. **Scan a leaf.** Tap **AI Scan** and pick a plant (new and weakest plants come first). Tap **Tap to add a leaf photo**, then **Scan Leaf**. Read the diagnosis, then tap **Save to Plant Record** or **Scan Again**.
   *Why it helps:* you decide what is saved. Photos are made smaller before upload, which helps on mobile data.
7. **Harvest and create the passport.** On the plant's detail page (**View More Details**), or from **Ready to Harvest** on Home, tap **Mark as Harvested**, then **Mark as Harvested & Generate Passport**. The passport page opens with a QR code and **Share on WhatsApp**. Print the QR or send the link to buyers. Note: your log notes appear on the public passport.
8. **Optional: walk your farm in 360°.** On **Map**, tap **3D**, then **＋ 360°**. Choose a full 360° photo (2:1 shape), tap where you stood, and tap **Save**. Drag to look around, tap white circles to move, and use **Tag plant** to pin plants on the photo.
9. **Sales, plans and language (partly preview).** On **Sales**, try **＋ List a Harvest**, **⚡ Boost** and **🎧 Customer Service** (approve or reject refund requests). In **Profile → My Plan**, check scan usage, then **Upgrade** or **Top up**. In **Profile → 🌐 Language**, switch between **EN** and **BM**.

On a laptop (1024 px or wider), the **Map** tab becomes a dashboard: key numbers, farm health over 14 days, plants that need care, upcoming harvests and a weather panel with charts.

### Buyer journey

1. **Scan the QR** with any phone camera, or open the link shared on WhatsApp. No app. No account.
2. **Read the passport.** You see the certificate (**Grow Days**, **Avg Health**, **AI Scans**), the **Trust Badges** and the **Growing Story**: every logged step, with dates.
3. **Share it** with **Share on WhatsApp**.
4. **Try the buyer app (preview).** Sign in as **Consumer** ("Know my food's story"). Use **Home**, **Market**, **Orders**, **Profile** and the **Scan QR** button (tap **Try a sample passport**). In **Market**, filter by **✓ Passport**, **Within 10km** or **Harvested today**. In **Orders**, open an order and use **Need help with this order?** to ask for a refund, leave feedback, contact the seller or **Ask the GreenMap admin** (an AI helper).

### What the score and badges mean

**Health score** = AI scan × 40% + watering × 25% + fertilizer × 20% + your own status × 15%. Bands: ✓ Healthy 70–100, ! Attention 40–69, ✕ Critical 0–39, + New (no score yet).

A badge only shows when it is earned:

| Badge | Earned when |
|---|---|
| Pesticide-Free | No care log has "Pesticide used" ticked |
| Organic | No fertilizer log has the category "Chemical" |
| AI-Verified | The plant had at least one AI scan |
| Verified Grower | The grower's profile is marked as verified |

## Try it: demo accounts

| Role | Email | Password | Created by |
|---|---|---|---|
| Grower | `ahmad@greenmap.demo` | `Demo1234!` | `npm run db:seed` |
| Buyer | `siti@greenmap.demo` | `Demo1234!` | `npm run seed:consumer` |

The grower owns the farm **Ladang Hijau** (Johor, tomatoes, about 30 plants). After `npm run db:seed`, a sample passport is always at `/passport/00000000-0000-4000-8000-0000deadbeef`.

Other commands (run inside `greenmap/`):

| Command | What it does |
|---|---|
| `npm run seed:billing` | Puts the grower on the free plan with 3 of 5 scans used, so the "out of scans" screen shows after 2 scans. |
| `npm run seed:support` | Adds demo refund requests, messages and feedback. Needs `seed:consumer` and migrations 0007–0008. |
| `npm run seed:panoramas` | Adds a 3-photo 360° tour to the demo farm, using the photos already in `greenmap/public/demo/`. Needs migration 0009 and `db:seed`. (`npm run demo:panos` re-downloads those photos; you normally don't need it.) |
| `npm run test:smoke` | Checks Supabase, the demo login and data reads, and tells you which step failed. |

> ⚠️ `npm run db:seed` deletes and recreates the demo grower's farms. Do not run it on data you want to keep.

**A 3-minute demo:** log in as Ahmad → **Home** (tap **Water All**) → **Map** (tap a marker, then **View More Details**) → check the score and trend → **AI Scan** → **Mark as Harvested** → open the passport on a second phone that is not logged in. (Deploy first, or set `NEXT_PUBLIC_APP_URL` to an address the phone can reach, because the QR code encodes that URL.) Full script: [greenmap/docs/08_DEMO.md](greenmap/docs/08_DEMO.md).

## Why it's good

- **One connected loop.** Farm map, care logs, AI scan, harvest and the public QR passport all work together in one app.
- **Nothing to install for buyers.** The passport is a normal web page. It opens from a phone camera with no login.
- **Scores come from records, not opinions.** The app works out health scores, badges and passport stats on the server, from the care logs and scans, using fixed rules. Growers don't type them in.
- **A score you can explain.** One formula runs on the server and on screen, so the map and the plant page always agree. Every colour also has an icon, so it is easy to read in bright sun.
- **Careful AI.** The grower checks every scan before saving. The server cleans every AI answer and works out the score itself. If a scan fails, you see "Couldn't analyse the photo", never a fake "Healthy", and no credit is used. Without a Gemini key, all AI features still run: AI Scan and AI Suggestion show clearly labelled sample output, and the support helper switches to simple keyword-based replies.
- **The AI helper cannot move money.** It can only suggest a next step. Buyers can only create *pending* refund requests, and only the seller can approve or reject them. The database enforces this, not just the screen.
- **Built for Malaysia.** English and Bahasa Melayu, prices in RM, plan names in Malay (Percuma, Asas, Petani Pro, Tanpa Had), FPX and Touch 'n Go (simulated), 16 states and federal territories in farm setup, and WhatsApp sharing.
- **Low prices.** The free plan gives 5 AI scans a month. Paid plans are RM 6.90 (20 scans), RM 19.90 (60) and RM 39.90 (unlimited). Extra scans are RM 1.50 each. The server enforces the limits.
- **Clear security model.** Row Level Security is on for every table, so a user can only change their own farm's data. The service-role key never reaches the browser. Prices are set on the server, so a browser cannot give itself a plan or free scans.
- **Phone first, desktop too.** Large buttons and a bottom tab bar on a phone. A full farm dashboard on a wide screen.
- **Hard to break in a live demo.** Weather (free Open-Meteo, no key) times out after 3.5 seconds and shows a labelled sample week. Without a MapTiler key, the Satellite option falls back to the generated Smart Background; with a key, Esri World Imagery steps in if MapTiler's image fails. Missing optional setup shows a friendly message instead of a crash.

## What's real and what's a preview

GreenMap is at the hackathon-demo stage. We want you to know exactly what works today.

| Area | Status |
|---|---|
| Farm setup, map, plants, care logs, Today's Tasks, health score | **Real.** Saved in the database. |
| AI Scan, AI Suggestion, AI support helper | **Real** with a Gemini key. Without one: labelled sample scans and tips, and keyword-based support replies. |
| Weather and watering advice | **Real** (Open-Meteo). Labelled sample week if the service is slow or offline. |
| Harvest Passport, QR code, trust badges | **Real.** The QR image comes from an outside service (api.qrserver.com), so it needs internet. |
| 360° farm tour | **Real.** Needs migration 0009 and ready-made 360° photos. The app does not take or stitch them. |
| Scan limits, plans, top-ups, boosts | **Real** limits and account changes. Payments are **simulated**: no real FPX or Touch 'n Go gateway yet. |
| Customer service (refunds, messages, feedback, stock) | **Real** records. Orders are demo data, approving a refund moves no money, and the seller chat adds a simulated auto-reply. |
| Marketplace, List a Harvest, My Sales | **Preview.** 5 mock listings with simulated sales and clicks. Listing a harvest saves nothing. The ranking code is real. |
| Buyer app: GreenPoints, orders, impact stats, "Buy now", in-app QR scanner | **Preview.** Mock data and screens. No real order is created. Use your phone's own camera to scan real QR codes. |
| Bahasa Melayu | **Partly done.** Tabs, Home, Map (including the plant quick actions), weather, 360° tour, care logs and the Language setting. Other screens are still English. |
| Leaderboard, GreenPoints rewards (points only appear in the buyer preview), commission payouts, B2B data | **Planned only.** No working code yet. |

Please also note:

- **Badges are self-reported.** They come from the grower's own logs, not a third-party certificate. There is no in-app process to become a Verified Grower yet; only the demo data sets it.
- **AI advice is advice.** A diagnosis is the model's best guess, not a lab result.
- **Business figures are plans.** Plan prices are in the code. Market size, costs and revenue figures are planning assumptions, not tested with real farmers yet.
- **Security hardening is still in progress.** Row Level Security keeps each user to their own data, but a few rules are wider than they should be: the three original photo buckets accept uploads from any signed-in user, passports can be listed (not only opened by their QR link), and the database does not yet make scores and badges server-only. The rules are in [greenmap/docs/03_BACKEND_TRUTH.md](greenmap/docs/03_BACKEND_TRUTH.md).

## Tech stack

| Part | Technology |
|---|---|
| Web app | Next.js 15.5 (App Router), React 19.2, TypeScript (strict mode) |
| Styling | Tailwind CSS v4 |
| Database, login, files | Supabase: Postgres with Row Level Security, Auth, Storage |
| 2D farm map | Konva + react-konva |
| 360° tour | three.js + @react-three/fiber, loaded only when you open 3D |
| AI | Google Gemini over REST (default model `gemini-2.0-flash`) |
| Weather / satellite | Open-Meteo (free, no key) / MapTiler, with Esri World Imagery as a backup |

## Run it locally

You need Node 18.18+ (Node 20 LTS recommended) and a free [Supabase](https://supabase.com) project.

```bash
cd greenmap
npm install
cp .env.example .env.local   # add your Supabase URL, anon key and service-role key
npm run db:seed              # after the 2 Supabase steps below
npm run dev                  # open http://localhost:3000
```

Before `npm run db:seed`:

1. In the Supabase **SQL Editor**, run `greenmap/supabase/migrations/0001_init.sql` to `0009_panoramas.sql`, in order.
2. In Supabase **Authentication → Sign In / Providers → Email**, turn off **Confirm email**.

Optional keys: `GEMINI_API_KEY` (real AI) and `MAPTILER_API_KEY` (satellite maps). When you deploy, set `NEXT_PUBLIC_APP_URL` to your public URL, so passport QR codes and WhatsApp links open on other phones.

Full guide (environment variables, troubleshooting, deploy to Vercel): [greenmap/README.md](greenmap/README.md) and [greenmap/scripts/README.md](greenmap/scripts/README.md).

## Repository layout

```
.
├── greenmap/                   The app (Next.js). Start here for the code.
│   ├── app/                    Pages and API routes
│   ├── components/             Screens and UI parts
│   ├── lib/                    Health score, AI, weather, billing, languages, Supabase
│   ├── supabase/migrations/    9 SQL migrations (0001–0009)
│   ├── scripts/                Seed scripts and smoke test
│   └── docs/                   Build plan, code concept, backend reference, demo script
├── skills-updated/             AI advisor notes: business model, data/AI logic, architecture
├── docs/superpowers/           Design specs and plans for newer features
├── greenmap-interactive.html   Early interactive prototype (single HTML file)
└── farm-map-dashboard.html     Early farm map dashboard prototype (single HTML file)
```

## Project docs

| Doc | What it covers |
|---|---|
| [greenmap/README.md](greenmap/README.md) | Developer guide: setup, environment, structure, deploy |
| [greenmap/scripts/README.md](greenmap/scripts/README.md) | Database setup, seed scripts and demo accounts |
| [greenmap/docs/00_BUILD_PLAN.md](greenmap/docs/00_BUILD_PLAN.md) | Build plan and scope |
| [greenmap/docs/01_CODE_CONCEPT.md](greenmap/docs/01_CODE_CONCEPT.md) | How the health score, AI scan and passport work |
| [greenmap/docs/02_PROTOTYPE_MAPPING.md](greenmap/docs/02_PROTOTYPE_MAPPING.md) | Prototype screens mapped to the real app |
| [greenmap/docs/03_BACKEND_TRUTH.md](greenmap/docs/03_BACKEND_TRUTH.md) | Tables, security rules and API routes |
| [greenmap/docs/08_DEMO.md](greenmap/docs/08_DEMO.md) | 3-minute demo script |
| [skills-updated/greenmap-business-strategist/](skills-updated/greenmap-business-strategist/) | Business model and pricing plan (planning assumptions) |

Some docs are older than the code. Where they disagree, the code is right. For example, there are now 9 migrations (not 4), and scan limits are enforced.
