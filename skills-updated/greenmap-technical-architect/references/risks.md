# GreenMap Technical Risks

| # | Risk | Severity | Mitigation |
|---|---|---|---|
| 1 | **Too many pages, core flow incomplete** | **Highest** | Build grower flow end-to-end (farm → plant → scan → harvest → QR) before touching landing page styling or polish |
| 2 | Konva.js canvas complexity | High | Build static canvas first. Add pan/zoom only if time allows. Fallback: static canvas with CSS zoom |
| 3 | Gemini returns invalid JSON | High | try/catch with one retry + stricter prompt. Hardcoded fallback response. Pre-test 3–4 demo photos |
| 4 | Gemini API rate limit or downtime during demo | High | Pre-tested photos only during live demo. Cache last successful result. Show cached scan on stage |
| 5 | Supabase RLS blocks legitimate queries | Medium | Test every query in Supabase SQL Editor first. Keep policies simple — own-data-only for growers |
| 6 | Farm Setup state lost between steps | Medium | React Context holds data across Steps 1–3. Write to Supabase only on Step 3. Refresh = restart (acceptable) |
| 7 | Auth middleware breaks navigation | Medium | Test middleware in Week 1. Keep it simple: check session exists, redirect if not |
| 8 | Image uploads fail or are slow | Medium | Compress images client-side before upload (max 1MB). Show upload progress. Graceful error message |
| 9 | Health score inconsistency (map vs detail) | Medium | Both Farm Map and Plant Detail recalculate on load using same shared function. Stored score updates only on explicit actions |
| 10 | Mapbox API fails during demo | Low | Use pre-captured static satellite assets. Zero API dependency on stage |
| 11 | QR page exposes private data | Low | QR page uses server component with service role key. Only fetches data for the specific qr_token. No browsing possible |
| 12 | health_score_history table grows large | Low | No issue for MVP scale (30 demo plants × ~50 events each = ~1500 rows). Index on plant_id + created_at |

## Demo-Day Checklist

Before going on stage:
- [ ] Seed script has been run, demo data looks correct
- [ ] Pre-tested plant photos loaded on demo device
- [ ] QR code printed or ready to display
- [ ] Mobile device charged and connected to reliable WiFi
- [ ] Verified: AI scan returns correct result with test photo
- [ ] Verified: QR page loads publicly without login
- [ ] Verified: all pages load within 3 seconds on mobile
- [ ] Backup: screenshots of every page in case of total system failure
