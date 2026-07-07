/**
 * Demo CONSUMER account — idempotent, farm-preserving.
 *
 * Creates (or re-confirms) a consumer login so you can experience the buyer /
 * consumer side (the QR "growing story" home). Touches ONLY this one account —
 * it never wipes farms or the grower's data.
 *
 *   Login:  siti@greenmap.demo  /  Demo1234!
 *
 * Run:  npm run seed:consumer
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/* ── Tiny .env.local loader (no dotenv dependency) ──────────────────────── */
function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) {
        process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
      }
    }
  } catch {
    // no .env.local — rely on real environment variables
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error(
    "\n✖ Missing env. Add NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env.local.\n" +
      "  (Service role key: Supabase Dashboard → Project Settings → API → service_role.)\n"
  );
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const EMAIL = "siti@greenmap.demo";
const PASSWORD = "Demo1234!"; // meets the strong-password rules
const NAME = "Siti Aminah";

async function findUserId(): Promise<string | null> {
  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  return data.users.find((u) => u.email === EMAIL)?.id ?? null;
}

async function main() {
  console.log("🛍️  Setting up the demo consumer account…");

  let userId = await findUserId();
  if (userId) {
    // Already exists — re-assert the password + confirmation so it always logs in.
    const { error } = await admin.auth.admin.updateUserById(userId, {
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { name: NAME, role: "consumer" },
    });
    if (error) throw error;
    console.log(`  • consumer account refreshed (${EMAIL})`);
  } else {
    const { data, error } = await admin.auth.admin.createUser({
      email: EMAIL,
      password: PASSWORD,
      email_confirm: true, // skip email confirmation for the demo
      user_metadata: { name: NAME, role: "consumer" },
    });
    if (error) throw error;
    userId = data.user.id;
    console.log(`  • consumer account created (${EMAIL})`);
  }

  // Ensure the profile row exists with the consumer role (the signup trigger
  // may default new profiles to 'grower', so set it explicitly).
  const { error: pErr } = await admin.from("profiles").upsert(
    { id: userId, name: NAME, email: EMAIL, role: "consumer" },
    { onConflict: "id" }
  );
  if (pErr) {
    console.error(
      `✖ ${pErr.message}\n  → Are migrations 0001–0005 applied?`
    );
    process.exit(1);
  }

  console.log(`✅ Consumer ready — login: ${EMAIL} / ${PASSWORD}`);
  console.log("   Lands on the consumer home (/consumer). Grower data untouched.");
}

main().catch((err) => {
  console.error("✖ seed:consumer failed:", err.message ?? err);
  process.exit(1);
});
