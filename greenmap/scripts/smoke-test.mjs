#!/usr/bin/env node
/**
 * GreenMap end-to-end smoke test — verifies the real data path stage by
 * stage, with a clear verdict at each step, so backend problems surface in
 * seconds instead of as vague "fetch failed" spam in the dev server log.
 *
 *   1. backend — DNS + Auth health of NEXT_PUBLIC_SUPABASE_URL
 *                (catches the free-tier auto-pause, wrong URL, no network)
 *   2. data    — sign in as the demo grower and read farms/plants through
 *                the public REST API (exercises auth + RLS)
 *   3. app     — (--app flag) with the dev/prod server running, request real
 *                pages with the session cookie and confirm they render data
 *
 * Usage:
 *   npm run test:smoke            # stages 1–2 (no app server needed)
 *   npm run test:smoke -- --app   # stages 1–3 (run `npm run dev` first)
 *
 * Credentials default to the seeded demo grower (scripts/seed-demo.ts);
 * override with SMOKE_EMAIL / SMOKE_PASSWORD.
 */

import { readFileSync } from "node:fs";
import { lookup } from "node:dns/promises";

// ── tiny .env.local loader (no dependency; file never wins over real env) ──
try {
  for (const line of readFileSync(new URL("../.env.local", import.meta.url), "utf8").split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2];
  }
} catch {
  // no .env.local — rely on real env vars
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const EMAIL = process.env.SMOKE_EMAIL || "ahmad@greenmap.demo";
const PASSWORD = process.env.SMOKE_PASSWORD || "Demo1234!";
const CHECK_APP = process.argv.includes("--app");

const ok = (msg) => console.log(`  \x1b[32m✓\x1b[0m ${msg}`);
const bad = (msg) => console.log(`  \x1b[31m✗\x1b[0m ${msg}`);
const die = (hint) => {
  if (hint) console.log(`\n${hint}`);
  process.exit(1);
};

if (!SUPABASE_URL || !ANON_KEY) {
  bad("NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY not set");
  die("Copy .env.example to .env.local and fill in your Supabase project keys.");
}
const HOST = new URL(SUPABASE_URL).hostname;
const REF = HOST.split(".")[0];

function get(path, headers = {}) {
  return fetch(`${SUPABASE_URL}${path}`, {
    headers: { apikey: ANON_KEY, ...headers },
    signal: AbortSignal.timeout(15_000),
  });
}

// ── stage 1: backend reachable ──────────────────────────────────────────────
console.log(`\nStage 1 · backend  (${HOST})`);
try {
  await lookup(HOST);
  ok("DNS resolves");
} catch {
  bad(`DNS cannot resolve ${HOST} — the project URL does not exist right now`);
  die(
    "This is the signature of a PAUSED Supabase project (free-tier projects\n" +
      "auto-pause after ~1 week idle and their DNS record is removed).\n\n" +
      "  → Log in at https://supabase.com/dashboard, open the project\n" +
      `    ("${REF}") and click "Restore project". Wait a few minutes,\n` +
      "    then re-run this script.\n\n" +
      "  If the project is no longer listed, create a new one, run the four\n" +
      "  files in supabase/migrations/ (see scripts/README.md), update\n" +
      "  .env.local with the new URL + keys, and run `npm run db:seed`."
  );
}

try {
  const res = await get("/auth/v1/health");
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  ok("Auth service healthy");
} catch (e) {
  bad(`Auth health check failed (${e.message ?? e})`);
  die("The project resolves but is not serving — it may still be waking up. Wait a minute and retry.");
}

// ── stage 2: demo login + RLS data reads ────────────────────────────────────
console.log(`\nStage 2 · data  (login ${EMAIL})`);
const tokenRes = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
  method: "POST",
  headers: { apikey: ANON_KEY, "Content-Type": "application/json" },
  body: JSON.stringify({ email: EMAIL, password: PASSWORD }),
  signal: AbortSignal.timeout(15_000),
});
if (!tokenRes.ok) {
  bad(`Sign-in failed (HTTP ${tokenRes.status})`);
  die("Demo grower missing or password changed — run `npm run db:seed` to (re)create it.");
}
const session = await tokenRes.json();
session.expires_at ??= Math.floor(Date.now() / 1000) + (session.expires_in ?? 3600);
ok("Signed in");

const authed = { Authorization: `Bearer ${session.access_token}` };
const farms = await (await get("/rest/v1/farms?select=id,name&order=created_at.desc", authed)).json();
if (!Array.isArray(farms) || farms.length === 0) {
  bad("No farms visible for the demo grower");
  die("RLS reads work but there is no data — run `npm run db:seed`.");
}
ok(`farms readable — ${farms.length} farm(s), first: "${farms[0].name}"`);

const plants = await (
  await get(`/rest/v1/plants?select=id&farm_id=eq.${farms[0].id}`, authed)
).json();
ok(`plants readable — ${plants.length} in "${farms[0].name}"`);

// ── stage 3 (optional): app pages render data with a real session ───────────
if (CHECK_APP) {
  console.log(`\nStage 3 · app  (${APP_URL})`);

  // Session cookie in @supabase/ssr's format: base64url JSON, chunked at 3180.
  const encoded = "base64-" + Buffer.from(JSON.stringify(session)).toString("base64url");
  const name = `sb-${REF}-auth-token`;
  const CHUNK = 3180;
  const cookie =
    encoded.length <= CHUNK
      ? `${name}=${encoded}`
      : Array.from({ length: Math.ceil(encoded.length / CHUNK) }, (_, i) =>
          `${name}.${i}=${encoded.slice(i * CHUNK, (i + 1) * CHUNK)}`
        ).join("; ");

  const page = async (path) => {
    const res = await fetch(`${APP_URL}${path}`, {
      headers: { Cookie: cookie },
      redirect: "manual",
      signal: AbortSignal.timeout(30_000),
    });
    const loc = res.headers.get("location");
    if (loc && new URL(loc, APP_URL).pathname.startsWith("/auth")) {
      bad(`${path} redirected to /auth — the app did not accept the session`);
      die();
    }
    return res;
  };

  try {
    // Generous: a cold `next dev` compiles the page on first request.
    await fetch(APP_URL, { signal: AbortSignal.timeout(30_000) });
  } catch {
    bad(`No app server on ${APP_URL}`);
    die("Start it first (`npm run dev` or `npm run build && npm start`), then re-run with --app.");
  }

  // /farms bounces to /auth when the session is rejected (page() dies on
  // that); any other outcome means the app accepted our session.
  const entry = await page("/farms");
  ok(`/farms accepted the session (HTTP ${entry.status})`);

  const home = await page(`/farms/${farms[0].id}`);
  const html = await home.text();
  if (home.status !== 200 || !html.includes(farms[0].name)) {
    bad(`farm home returned ${home.status} without "${farms[0].name}" in the HTML`);
    die();
  }
  ok(`farm home renders live data ("${farms[0].name}")`);

  const scan = await page(`/farms/${farms[0].id}/scan`);
  if (scan.status !== 200) {
    bad(`scan tab returned ${scan.status}`);
    die();
  }
  ok("scan tab renders");
}

console.log(
  CHECK_APP
    ? "\nAll good ✅ — backend reachable, demo data readable, app renders it."
    : "\nAll good ✅ — backend reachable and demo data readable. Add `-- --app` (with the dev server running) to test page rendering too."
);
