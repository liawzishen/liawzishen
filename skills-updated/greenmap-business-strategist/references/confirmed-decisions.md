# Confirmed Business Model Decisions

> Reference file for the greenmap-business-strategist skill.
> These decisions were discussed and agreed upon during business model planning.
> Do not re-debate unless the user explicitly asks to revisit.

---

## 1. AI Scan Subscription Tiers

### Pricing

| Tier | Malay Name | Scans/Month | Price (RM/month) | Target User |
|---|---|---|---|---|
| Free | Percuma | 5 | RM 0 | New farmers trying GreenMap |
| Basic | Asas | 20 | RM 6.90 | Small farm, handful of plants |
| Pro | Petani Pro | 60 | RM 19.90 | Active farmer, regular scanning |
| Unlimited | Tanpa Had | Unlimited | RM 39.90 | Large farm or multiple farms |

### Pricing Rationale

- RM 6.90 entry = "less than a nasi lemak per day" — removes psychological resistance
- Malay tier names signal the product is built for Malaysian farmers
- RM 39.90 ceiling is within range of Malaysian digital tool spending (mobile data RM 30–50, Astro RM 40–100)
- Free 5 scans are genuinely useful, not crippled — enough to scan most concerning plants

### Credit Rules

- **Per-account** — shared across all farms owned by the grower
- **No rollover** — unused scans expire at month end
- **Top-up available** — RM 1.50 per additional scan, no subscription required
- **No partial refunds** — cancel anytime, access until period ends
- **Existing data preserved** — scan history is never locked or removed regardless of tier

### UI Behavior

AI Scan button shows remaining credits: `🔬 AI Scan (3 of 5 remaining)`

When exhausted: show top-up and upgrade options, plus refresh date. Never block access to existing scan history.

---

## 2. GreenPoints Economy

### Core Properties

- Currency symbol: 🌱
- Non-transferable between accounts
- Role-locked earning (grower missions for growers, consumer missions for consumers)
- Expires 6 months from date earned
- Per-account only, no pooling

### Grower Earning — Daily & Weekly

| Mission | Points | Frequency |
|---|---|---|
| Daily login | 🌱 2 | Daily |
| Log watering | 🌱 3 | Daily |
| Log fertilizer | 🌱 3 | Daily |
| Complete all daily missions | 🌱 5 bonus | Daily |
| 7-day activity streak | 🌱 20 bonus | Weekly |
| Upload plant photo (non-scan) | 🌱 5 | Weekly cap: 3 |

### Grower Earning — Milestones (One-Time)

| Mission | Points |
|---|---|
| Complete farm setup | 🌱 30 |
| Add first 10 plants | 🌱 20 |
| First AI scan | 🌱 15 |
| Generate first Harvest Passport | 🌱 50 |
| Refer a farmer who signs up | 🌱 50 (per referral) |
| First consumer QR scan on passport | 🌱 30 |

### Grower Earning — Selling Missions

Deliberately generous to pull farmers into marketplace:

| Mission | Points |
|---|---|
| List first product for sale | 🌱 100 |
| Complete first sale | 🌱 80 |
| Receive first 5-star review | 🌱 40 |
| Complete 10 sales | 🌱 100 |
| Maintain Verified Grower 30 days | 🌱 60 (monthly) |
| Attach Harvest Passport to listing | 🌱 20 (per listing) |

### Consumer Earning

| Mission | Points |
|---|---|
| Daily login | 🌱 2 |
| Scan QR Harvest Passport | 🌱 5 |
| Complete a purchase | 🌱 10 + 1 per RM spent |
| Leave review with photo | 🌱 15 |
| Share Passport on WhatsApp | 🌱 10 |
| Refer friend who purchases | 🌱 50 |

### Spending

**AI Scan Redemption (Grower only):**
- 1 scan = 🌱 30
- 5 scan bundle = 🌱 120 (save 30)
- 10 scan bundle = 🌱 200 (save 100)

**Discount Vouchers (Both roles):**
- RM 1 voucher = 🌱 100
- RM 5 voucher = 🌱 400
- Free delivery voucher = 🌱 150

### Economics Check

Daily missions = ~🌱 13/day = ~🌱 390/month = ~13 extra AI scans. Meaningful but not enough to kill paid tier conversion.

### Dual-Role Users

One account, one primary role (Grower). If grower buys from another farmer, they earn standard purchase points (🌱 10 + 1 per RM) but NOT consumer-specific missions.

---

## 3. Leaderboard System

### Three Levels

- 🏆 National — Top growers across all of Malaysia
- 🏅 State — Top growers per state (13 states + 3 federal territories)
- 🌾 Crop — Top growers per crop type

### Grower Score Formula

```
Grower Score =
    Average plant health score    × 30%
    Harvest Passport count        × 25%
    Consumer review rating        × 20%
    AI scan consistency           × 15%
    Platform activity             × 10%
```

Ranks by Grower Score, NOT GreenPoints. Rewards quality farming, not mission grinding.

### Monthly Rewards

| Rank | Reward |
|---|---|
| #1 in state | 🌱 500 + Top Grower badge + featured in app |
| #2 in state | 🌱 300 + Top Grower badge |
| #3 in state | 🌱 200 + Top Grower badge |
| Top 10 in state | 🌱 100 |
| #1 National | 🌱 1000 + Malaysia's Top Grower badge + free Unlimited AI tier 1 month |

### Badge Display

Badge appears on Harvest Passport: `🏆 Top Grower — Johor — June 2026`

### Anti-Gaming

- Minimum 10 plants + 1 completed harvest to appear
- Only verified purchase reviews count
- Gemini flags stock or repeated images
- Monthly reset prevents permanent domination

---

## 4. Marketplace Design

### Core Principles

- Location-first (fresh produce is local)
- Freshness-aware (perishable goods, not manufactured)
- Passport-powered (Harvest Passport is the trust differentiator)
- Farmer-managed delivery (GreenMap is not a logistics company)

### Two Listing Paths

**Path A — From Harvest Passport (recommended):**
Auto-fills product name, harvest date, growing story, trust badges, location, grower profile from existing data. Farmer adds only: quantity, price, fresh photo, availability window, pickup/delivery. Two minutes from harvest to listed.

**Path B — Manual listing:**
All fields manual. No trust badges. Naturally less attractive to consumers — teaches farmers that tracking plants = better sales.

### Freshness Clock

All listings have automatic expiry based on availability window. Farmer notified before expiry. Consumer sees urgency labels. Expired listings auto-move to "Ended."

### Delivery

| Option | Details |
|---|---|
| Self Pickup | Farm address auto-filled, farmer sets hours |
| Farmer Delivery | Flat fee, farmer-controlled max distance (10/25/50km), delivery window, minimum order |

Flat fee (not distance-based) for simplicity. Minimum order prevents uneconomical deliveries. If consumer is out of range, delivery greyed out with explanation.

### Consumer Discovery

1. **Location-based feed** — default, sorted by freshness and proximity
2. **Search by crop** — with filters for distance, price, trust level
3. **Browse by farm** — follow farms, get notifications on new listings
4. **QR scan entry** — scan at market → passport → "Buy more from this farm" → active listings

### Consumer Filters

Distance, crop type, trust level (Passport Verified only / AI Verified / Any), price, freshness (today / 3 days / week), certification (pesticide free / organic / Top Grower).

### Order Flow

Consumer selects quantity + delivery → payment → escrow hold → farmer confirms within 2 hours → fulfills → consumer confirms receipt → 24-hour hold → money released (minus commission).

---

## 5. Commission Structure

| Scenario | Rate | Rationale |
|---|---|---|
| Standard sale | 6% | Competitive with Shopee ~12–15% |
| Harvest Passport attached | 5% | Rewards transparency |
| Promoted listing sale | 8% | Premium visibility costs more |
| GreenMap Certified Grower | 4% | Rewards loyalty and quality |

Commission decreases for better farmers — opposite of Shopee's flat rate. Incentivizes tracking plants and generating passports.

**Commission on produce value only, not delivery fee.** Farmer provides delivery service — GreenMap doesn't take a cut of that.

### Transaction Reality

On RM 15 produce sale:
- Payment gateway fee (~2.5% + RM 0.50): -RM 0.88
- GreenMap commission (6%): -RM 0.90
- Farmer receives: RM 13.22 (~88% of sale price)
- Better than pasar borong middleman margins (30–50% lower)

---

## 6. Payment System

### Methods

- FPX Online Banking — all major Malaysian banks
- Touch 'n Go eWallet — 20+ million Malaysian users
- Together cover ~85–90% of Malaysian digital transactions

### Escrow Model

Consumer pays → GreenMap holds → farmer delivers → consumer confirms → 24-hour hold → money released to farmer minus commission. Delivery fee goes 100% to farmer.

### MVP Implementation

Fully built payment UI with simulated transactions. Orders saved with `payment_status: 'simulated'`. All system features (notifications, order management, GreenPoints) work identically. Checkout shows: `🔒 Payment gateway integration ready for production. Demo mode: transactions are simulated.`

Production switch: replace one function with real gateway API calls (Revenue Monster or Stripe Malaysia recommended).

---

## 7. Advertising Revenue (Month 12+)

| Type | Buyer | Price |
|---|---|---|
| Promoted Farm Listing | Farmers wanting visibility | RM 5–15/boost |
| Agri-brand Banner Ads | Fertilizer, seed, equipment companies | CPM-based |
| Sponsored Certification Badges | Certification bodies, organic associations | Per-badge partnership fee |

---

## 8. B2B Data Insights (Month 18+)

- Aggregated crop health trends (anonymised) for government, NGOs, researchers
- Supply chain intelligence for wholesale buyers, supermarkets
- Verified farmer network access for restaurants, organic retailers
- Individual farmer data never sold without explicit consent

---

## 9. Cost Structure

### At 1,000 Farmers

| Service | Monthly Cost |
|---|---|
| Gemini Vision API | ~RM 200–500 |
| Supabase Pro | ~RM 100 |
| Vercel Pro | ~RM 80 |
| Mapbox | Likely still free |
| Domain + email | ~RM 5–50 |
| **Total** | **~RM 400–700** |

Cost per farmer: ~RM 0.40–0.70/month.

### Break-Even

At 15% paid conversion to Asas (RM 6.90):
- Revenue: 150 × RM 6.90 = RM 1,035/month
- Cost: ~RM 700/month
- Net: RM 335/month — profitable on subscriptions alone

---

## 10. Launch Phases

```
Phase 0 — Hackathon Demo (Now)
  Revenue: RM 0 | Cost: RM 0 | Goal: Win, validate concept
  All free, simulated payments, pre-loaded demo data

Phase 1 — Soft Launch (Month 1–3)
  Revenue: RM 0 | Cost: Minimal
  Goal: First 100 farmers, product quality, word-of-mouth
  10 free AI scans/month during soft launch

Phase 2 — Monetisation (Month 4–8)
  Revenue: AI scan tiers + GreenPoints economy
  Goal: 10–15% paid conversion
  Marketplace in invite-only beta

Phase 3 — Marketplace Live (Month 9–14)
  Revenue: AI tiers + commission + first ads
  Goal: 500 farmers, 2,000 consumers
  FPX + TnG connected for real

Phase 4 — Scale (Month 15+)
  Revenue: All five streams active
  Goal: State-by-state expansion
  B2B data insights programme begins
```

---

## 11. Competitive Moat

| Moat | Why Hard to Replicate |
|---|---|
| Harvest Passport | Requires integrated farm management + AI scanning + transparency |
| AI-verified records | Historical data builds over time — new entrants start from zero |
| Farm-to-consumer chain | One platform connecting grower actions to consumer verification |
| GreenPoints + Leaderboard | Accumulated points, badges, reputation = switching cost |
| Malaysian-first design | Malay naming, TnG, state features, WhatsApp sharing |

---

## 12. Shopee/Lazada Model Mapping

| Shopee/Lazada | GreenMap Equivalent |
|---|---|
| Seller commission | Transaction fee 4–8% |
| Shopee Ads / Boost | Promoted Farm Listings |
| Shopee Mall | Harvest Passport verified growers |
| Star ratings | Health scores + AI verification + trust badges |
| Preferred Seller | GreenMap Certified Grower badge |
| Shopee Coins | GreenPoints 🌱 |
| ShopeePay | Future: in-app wallet |
| Free shipping | Subsidised delivery for verified growers |
| Shopee Live | Future: live farm tours |

---

## 13. Marketplace Pages (Future — Not MVP)

| Page | Route | Role |
|---|---|---|
| Marketplace Browse | `/market` | Consumer |
| Product Detail | `/market/[listingId]` | Consumer |
| Create Listing | `/farms/[farmId]/sell` | Grower |
| My Listings | `/farms/[farmId]/listings` | Grower |
| My Orders (Consumer) | `/orders` | Consumer |
| My Orders (Grower) | `/farms/[farmId]/orders` | Grower |
| Chat | `/messages` | Both |
| Checkout | `/checkout` | Consumer |

These 8 pages are NOT part of the hackathon MVP. They are designed and documented for Phase 3.

---

## 14. Key Risks

| Risk | Mitigation |
|---|---|
| Low farmer adoption | Free tier genuinely useful; solve real daily farm problems |
| Farmers won't pay | RM 6.90 entry very low; GreenPoints offer free alternative |
| Marketplace cold-start | Selling missions incentivise listing; QR bridges offline to online |
| GreenPoints inflation | 6-month expiry, careful earning rates, regular balancing |
| Fake reviews/gaming | Role-locked earning, verified purchase reviews, AI image check |
| Payment complexity | Simulated for MVP; single function swap for production |

---

## 15. Revenue Projections (Assumptions Clearly Marked)

### Month 9 — Marketplace Launch

**Assumptions:** 300 active farmers, 17% selling, 3 listings/seller, RM 25 avg order, 4 orders/listing.

- Monthly GMV: RM 15,000
- Commission (6%): RM 900
- AI tier revenue: RM 600
- **Total: RM 1,500/month**

### Month 14 — 5 Months Post-Launch

**Assumptions:** 800 active farmers, 25% selling, 4 listings/seller, RM 30 avg order, 6 orders/listing.

- Monthly GMV: RM 144,000
- Commission (6%): RM 8,640
- AI tier revenue: RM 2,400
- Advertising: RM 500
- **Total: RM 11,540/month**

These are projections based on stated assumptions. Actual numbers depend on adoption rates, marketplace activity, and conversion. The growth from RM 1,500 to RM 11,540 in 5 months assumes marketplace network effects similar to early Shopee Malaysia — aggressive but plausible if execution is strong.
