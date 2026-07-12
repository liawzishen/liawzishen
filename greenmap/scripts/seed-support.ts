/**
 * Demo CUSTOMER-SERVICE data — idempotent, farm-preserving.
 *
 * Seeds a refund request, a customer message and feedback FROM the demo
 * consumer (Siti) on the demo grower's listing (Ladang Hijau · order
 * GM-L1-02), plus one out-of-stock listing — so Ahmad's "Customer Service"
 * inbox and the marketplace out-of-stock state are populated for the demo.
 *
 * Run:  npm run seed:support   (needs seed:consumer + migrations 0007, 0008)
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in .env.local.
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

function loadEnv() {
  try {
    const text = readFileSync(resolve(process.cwd(), ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    /* rely on real env */
  }
}
loadEnv();

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error("\n✖ Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local.\n");
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const CONSUMER_EMAIL = "siti@greenmap.demo";
const SELLER_FARM = "Ladang Hijau"; // the demo grower's farm
const ORDER = "GM-L1-02";

async function main() {
  console.log("🎧 Seeding demo customer-service data…");

  const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  if (error) throw error;
  const siti = data.users.find((u) => u.email === CONSUMER_EMAIL);
  if (!siti) {
    console.error(`✖ ${CONSUMER_EMAIL} not found — run \`npm run seed:consumer\` first.`);
    process.exit(1);
  }

  const guard = (label: string, err: { message: string } | null) => {
    if (err) {
      console.error(
        `✖ ${label}: ${err.message}\n  → Are migrations 0007_support.sql and 0008_seller_support.sql applied?`
      );
      process.exit(1);
    }
  };

  // Idempotent: clear this consumer's prior demo support rows first.
  await admin.from("refund_requests").delete().eq("user_id", siti.id).eq("order_ref", ORDER);
  await admin.from("support_messages").delete().eq("user_id", siti.id).eq("order_ref", ORDER);
  await admin.from("order_feedback").delete().eq("user_id", siti.id).eq("order_ref", ORDER);

  guard(
    "refund_requests",
    (
      await admin.from("refund_requests").insert({
        user_id: siti.id,
        order_ref: ORDER,
        item: "Organic Cherry Tomatoes",
        farm: SELLER_FARM,
        kind: "refund",
        reason: "A few tomatoes were crushed on arrival.",
        status: "pending",
      })
    ).error
  );

  guard(
    "support_messages",
    (
      await admin.from("support_messages").insert({
        user_id: siti.id,
        thread: "seller",
        order_ref: ORDER,
        seller_name: SELLER_FARM,
        sender: "customer",
        body: "Hi! A few of the tomatoes were soft — is there anything you can do?",
      })
    ).error
  );

  guard(
    "order_feedback",
    (
      await admin.from("order_feedback").insert({
        user_id: siti.id,
        order_ref: ORDER,
        farm: SELLER_FARM,
        rating: 4,
        comment: "Lovely flavour overall — just a couple were bruised.",
      })
    ).error
  );

  // One out-of-stock listing so the marketplace shows the state (Pak Choi).
  guard(
    "listing_stock",
    (
      await admin.from("listing_stock").upsert(
        { listing_id: "l3", seller_farm: "Green Valley", in_stock: false, qty: 0 },
        { onConflict: "listing_id" }
      )
    ).error
  );

  console.log("✅ Seeded 1 refund, 1 message, 1 feedback on Ladang Hijau · GM-L1-02.");
  console.log("   Pak Choi (l3) set out of stock. Log in as ahmad@greenmap.demo → Sales → Customer Service.");
}

main().catch((err) => {
  console.error("✖ seed:support failed:", err.message ?? err);
  process.exit(1);
});
