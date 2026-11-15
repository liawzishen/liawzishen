import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDatabase, migrationFiles } from "./harness";

/*
 * Each test is an attack (or a normal action that must keep working) run
 * against a real Postgres with every migration applied. The browser is the
 * `authenticated` role; the server is `service_role`.
 */

let db: TestDatabase;

// People
let ahmad: string; // grower, owns the farm "Ladang Hijau" first
let bad: string; // a second grower who tries to break the rules
let siti: string; // shopper

// Things
let farm: string;
let plant: string;
let badFarm: string;
let badPlant: string;

const SCAN = "https://x.supabase.co/storage/v1/object/public/plant-scans/p/1.jpg";

beforeAll(async () => {
  db = await TestDatabase.create();

  ahmad = await db.createUser("ahmad@test.local");
  bad = await db.createUser("bad@test.local");
  siti = await db.createUser("siti@test.local");

  const newFarm = async (user: string, name: string) =>
    (
      await db.asUser(
        user,
        `insert into farms (user_id, name, location, crop_type)
         values ($1, $2, 'Johor', 'Tomato') returning id`,
        [user, name]
      )
    )[0].id as string;
  const newPlant = async (user: string, farmId: string) =>
    (
      await db.asUser(
        user,
        `insert into plants (farm_id, name, type) values ($1, 'Tomato 1', 'Tomato') returning id`,
        [farmId]
      )
    )[0].id as string;

  farm = await newFarm(ahmad, "Ladang Hijau");
  plant = await newPlant(ahmad, farm);
  badFarm = await newFarm(bad, "Kebun Lain");
  badPlant = await newPlant(bad, badFarm);
}, 60_000);

afterAll(async () => {
  await db.close();
});

/** The Postgres error code of a statement that must fail. */
async function errorCode(run: Promise<unknown>): Promise<string> {
  try {
    await run;
  } catch (e) {
    return (e as { code?: string }).code ?? "unknown";
  }
  return "no error";
}

const PERMISSION_DENIED = "42501"; // also what a failed RLS check reports
const CHECK_VIOLATION = "23514";

describe("migrations", () => {
  it("can all be run a second time (they say they are safe to re-run)", async () => {
    for (const file of migrationFiles()) await db.applyMigration(file);
  });
});

describe("storage: only the uploader can replace or delete a file", () => {
  const upload = (user: string, name: string) =>
    db.asUser(
      user,
      `insert into storage.objects (bucket_id, name, owner_id) values ('plant-scans', $1, $2)
       on conflict (bucket_id, name) do update set owner_id = excluded.owner_id
       returning name`,
      [name, user]
    );

  it("lets a signed-in user upload a new file (upsert on a new path)", async () => {
    expect(await upload(ahmad, "p/1.jpg")).toHaveLength(1);
  });

  it("stops another account from overwriting or deleting it", async () => {
    expect(await errorCode(upload(bad, "p/1.jpg"))).toBe(PERMISSION_DENIED);
    expect(
      await db.asUser(bad, "delete from storage.objects where name = 'p/1.jpg' returning name")
    ).toHaveLength(0);
    expect(
      await db.asUser(
        bad,
        "update storage.objects set name = 'p/stolen.jpg' where name = 'p/1.jpg' returning name"
      )
    ).toHaveLength(0);
  });

  it("still lets the uploader replace and delete their own file", async () => {
    expect(await upload(ahmad, "p/1.jpg")).toHaveLength(1);
    expect(
      await db.asUser(ahmad, "delete from storage.objects where name = 'p/1.jpg' returning name")
    ).toHaveLength(1);
  });

  it("limits every bucket to images of a bounded size", async () => {
    const buckets = await db.admin(
      "select id, file_size_limit, allowed_mime_types from storage.buckets"
    );
    expect(buckets).toHaveLength(4);
    for (const bucket of buckets) {
      expect(Number(bucket.file_size_limit)).toBeGreaterThan(0);
      expect(bucket.allowed_mime_types).toEqual(["image/jpeg", "image/png", "image/webp"]);
    }
  });
});

describe("trust data: only the server writes scores, scans and passports", () => {
  it("ignores a health score and a harvested flag sent by the browser", async () => {
    const [row] = await db.asUser(
      ahmad,
      `insert into plants (farm_id, name, type, health_score, lifecycle_status, created_at)
       values ($1, 'Cheat', 'Tomato', 100, 'harvested', '2001-01-01')
       returning health_score, lifecycle_status, created_at > now() - interval '1 minute' as fresh`,
      [farm]
    );
    expect(row).toEqual({ health_score: null, lifecycle_status: "active", fresh: true });

    const [updated] = await db.asUser(
      ahmad,
      `update plants set health_score = 100, lifecycle_status = 'harvested', manual_status = 'healthy'
       where id = $1 returning health_score, lifecycle_status, manual_status`,
      [plant]
    );
    // The grower's own status is saved; the two server columns are untouched.
    expect(updated).toEqual({
      health_score: null,
      lifecycle_status: "active",
      manual_status: "healthy",
    });
  });

  it("lets the server set the score", async () => {
    const [row] = await db.asService(
      "update plants set health_score = 82 where id = $1 returning health_score",
      [plant]
    );
    expect(row.health_score).toBe(82);
  });

  it("refuses AI scans, score history and passports written by the browser", async () => {
    expect(
      await errorCode(
        db.asUser(
          ahmad,
          `insert into ai_analyses (plant_id, image_url, diagnosis, severity, confidence)
           values ($1, $2, 'Healthy', 'none', 100)`,
          [plant, SCAN]
        )
      )
    ).toBe(PERMISSION_DENIED);
    expect(
      await errorCode(
        db.asUser(ahmad, "insert into health_score_history (plant_id, score) values ($1, 100)", [
          plant,
        ])
      )
    ).toBe(PERMISSION_DENIED);
    expect(
      await errorCode(
        db.asUser(
          ahmad,
          `insert into harvest_passports (plant_id, farm_id, organic, pesticide_free, ai_verified, avg_health)
           values ($1, $2, true, true, true, 100)`,
          [plant, farm]
        )
      )
    ).toBe(PERMISSION_DENIED);
  });

  it("lets the grower add care events, but not AI or harvest events", async () => {
    expect(
      await db.asUser(
        ahmad,
        "insert into growth_logs (plant_id, event_type) values ($1, 'water') returning id",
        [plant]
      )
    ).toHaveLength(1);
    for (const event of ["ai_scan", "harvested"]) {
      expect(
        await errorCode(
          db.asUser(ahmad, "insert into growth_logs (plant_id, event_type) values ($1, $2)", [
            plant,
            event,
          ])
        )
      ).toBe(PERMISSION_DENIED);
    }
  });

  it("does not accept events for someone else's plant", async () => {
    expect(
      await errorCode(
        db.asUser(bad, "insert into growth_logs (plant_id, event_type) values ($1, 'water')", [
          plant,
        ])
      )
    ).toBe(PERMISSION_DENIED);
  });

  it("keeps the growth record append-only and not back-dated", async () => {
    const [log] = await db.asUser(
      ahmad,
      `insert into growth_logs (plant_id, event_type, created_at)
       values ($1, 'fertilize', '2001-01-01')
       returning id, created_at > now() - interval '1 minute' as fresh`,
      [plant]
    );
    expect(log.fresh).toBe(true);
    expect(
      await errorCode(
        db.asUser(ahmad, "update growth_logs set note = 'edited' where id = $1", [log.id])
      )
    ).toBe(PERMISSION_DENIED);
    expect(
      await errorCode(db.asUser(ahmad, "delete from growth_logs where id = $1", [log.id]))
    ).toBe(PERMISSION_DENIED);
  });

  it("lets the server write a passport that the owner can read and nobody can list", async () => {
    await db.asService(
      `insert into ai_analyses (plant_id, image_url, diagnosis) values ($1, $2, 'Healthy')`,
      [plant, SCAN]
    );
    await db.asService(
      "insert into harvest_passports (plant_id, farm_id, avg_health) values ($1, $2, 82)",
      [plant, farm]
    );

    expect(await db.asUser(ahmad, "select id from harvest_passports")).toHaveLength(1);
    expect(await db.asUser(ahmad, "select id from ai_analyses")).toHaveLength(1);
    // Signed out, or another grower: nothing. (The public QR page reads one
    // passport by its token through the server.)
    expect(await db.asAnon("select id from harvest_passports")).toHaveLength(0);
    expect(await db.asUser(bad, "select id from harvest_passports")).toHaveLength(0);

    expect(
      await errorCode(db.asUser(ahmad, "update harvest_passports set organic = true"))
    ).toBe(PERMISSION_DENIED);
    expect(await errorCode(db.asUser(ahmad, "delete from harvest_passports"))).toBe(
      PERMISSION_DENIED
    );
  });

  it("saves one analysis per scanned photo", async () => {
    expect(
      await errorCode(
        db.asService(
          "insert into ai_analyses (plant_id, image_url, diagnosis) values ($1, $2, 'Again')",
          [plant, SCAN]
        )
      )
    ).toBe("23505"); // unique_violation
  });
});

describe("seller name: a later farm cannot take over a name in use", () => {
  let refund: string;

  beforeAll(async () => {
    // Siti (shopper) asks Ahmad's farm for a refund and sends a message.
    refund = (
      await db.asUser(
        siti,
        `insert into refund_requests (user_id, order_ref, item, farm, kind, reason)
         values ($1, 'GM-L1-02', 'Tomatoes', 'Ladang Hijau', 'refund', 'Arrived damaged')
         returning id`,
        [siti]
      )
    )[0].id as string;
    await db.asUser(
      siti,
      `insert into support_messages (user_id, thread, order_ref, seller_name, sender, body)
       values ($1, 'seller', 'GM-L1-02', 'Ladang Hijau', 'customer', 'Where is my order?')`,
      [siti]
    );
    await db.asUser(
      siti,
      `insert into order_feedback (user_id, order_ref, farm, rating, comment)
       values ($1, 'GM-L1-02', 'Ladang Hijau', 2, 'Late')`,
      [siti]
    );

    // The attacker makes a farm with the same name, and tries to look older.
    await db.asUser(
      bad,
      `insert into farms (user_id, name, location, crop_type, created_at, name_claimed_at)
       values ($1, 'Ladang Hijau', 'Johor', 'Tomato', '2001-01-01', '2001-01-01')`,
      [bad]
    );
  });

  it("shows the seller inbox to the first owner of the name only", async () => {
    for (const table of ["refund_requests", "support_messages", "order_feedback"]) {
      expect(await db.asUser(ahmad, `select id from ${table}`), table).toHaveLength(1);
      expect(await db.asUser(bad, `select id from ${table}`), table).toHaveLength(0);
    }
  });

  it("does not let the copycat decide the refund or answer as the seller", async () => {
    expect(
      await db.asUser(
        bad,
        "update refund_requests set status = 'approved' where id = $1 returning id",
        [refund]
      )
    ).toHaveLength(0);
    expect(
      await errorCode(
        db.asUser(
          bad,
          `insert into support_messages (user_id, thread, order_ref, seller_name, sender, body)
           values ($1, 'seller', 'GM-L1-02', 'Ladang Hijau', 'seller', 'Send me your bank PIN')`,
          [siti]
        )
      )
    ).toBe(PERMISSION_DENIED);
  });

  it("does not let an older farm win the name by being renamed to it", async () => {
    // badFarm was created before this rename, but the claim starts now.
    await db.asUser(bad, "update farms set name = 'Ladang Hijau' where id = $1", [badFarm]);
    expect(await db.asUser(bad, "select id from refund_requests")).toHaveLength(0);
    await db.asUser(bad, "update farms set name = 'Kebun Lain' where id = $1", [badFarm]);
  });

  it("does not let a shopper approve their own refund", async () => {
    // Siti opens a request against a farm name that she then registers herself.
    const [own] = await db.asUser(
      siti,
      `insert into refund_requests (user_id, order_ref, item, farm, kind)
       values ($1, 'GM-X', 'Chili', 'Kebun Siti Sendiri', 'refund') returning id`,
      [siti]
    );
    await db.asUser(
      siti,
      `insert into farms (user_id, name, location, crop_type)
       values ($1, 'Kebun Siti Sendiri', 'Johor', 'Chili')`,
      [siti]
    );
    expect(
      await db.asUser(
        siti,
        "update refund_requests set status = 'approved' where id = $1 returning id",
        [own.id]
      )
    ).toHaveLength(0);
  });

  it("does not let a shopper start a request that is already approved", async () => {
    expect(
      await errorCode(
        db.asUser(
          siti,
          `insert into refund_requests (user_id, order_ref, farm, kind, status)
           values ($1, 'GM-Y', 'Ladang Hijau', 'refund', 'approved')`,
          [siti]
        )
      )
    ).toBe(PERMISSION_DENIED);
  });

  it("lets the real seller answer, and decide the refund exactly once", async () => {
    expect(
      await db.asUser(
        ahmad,
        `insert into support_messages (user_id, thread, order_ref, seller_name, sender, body)
         values ($1, 'seller', 'GM-L1-02', 'Ladang Hijau', 'seller', 'On the way!') returning id`,
        [siti]
      )
    ).toHaveLength(1);

    // Only the status column may change.
    expect(
      await errorCode(
        db.asUser(ahmad, "update refund_requests set reason = 'changed' where id = $1", [refund])
      )
    ).toBe(PERMISSION_DENIED);

    expect(
      await db.asUser(
        ahmad,
        "update refund_requests set status = 'approved' where id = $1 returning status",
        [refund]
      )
    ).toEqual([{ status: "approved" }]);
    // Decided: it cannot be flipped afterwards.
    expect(
      await db.asUser(
        ahmad,
        "update refund_requests set status = 'rejected' where id = $1 returning status",
        [refund]
      )
    ).toHaveLength(0);
  });

  it("lets the server (the seed script) give a re-created demo farm an old claim", async () => {
    const [row] = await db.asService(
      `update farms set name_claimed_at = '2020-01-01T00:00:00Z' where id = $1
       returning name_claimed_at < now() - interval '1 year' as old`,
      [farm]
    );
    expect(row.old).toBe(true);
    // The browser cannot do the same for its own farm.
    const [mine] = await db.asUser(
      bad,
      `update farms set name_claimed_at = '2001-01-01', created_at = '2001-01-01' where id = $1
       returning name_claimed_at > now() - interval '1 hour' as recent, created_at > now() - interval '1 hour' as fresh`,
      [badFarm]
    );
    expect(mine).toEqual({ recent: true, fresh: true });
  });

  it("passes the name to the next farm when the first owner's farm is deleted", async () => {
    const spare = await db.createUser("spare@test.local");
    const other = await db.createUser("other@test.local");
    const insert = (user: string) =>
      db.asUser(
        user,
        `insert into farms (user_id, name, location, crop_type)
         values ($1, 'Dusun Bersama', 'Perak', 'Durian') returning id`,
        [user]
      );
    const [first] = await insert(spare);
    await insert(other);
    const owns = async (user: string) =>
      (await db.asUser(user, "select owns_seller_name('Dusun Bersama') as yes"))[0].yes;

    expect([await owns(spare), await owns(other)]).toEqual([true, false]);
    await db.asUser(spare, "delete from farms where id = $1", [first.id]);
    expect(await owns(other)).toBe(true);
  });
});

describe("support chat and stock", () => {
  it("lets a shopper write as the customer only", async () => {
    const send = (sender: string) =>
      db.asUser(
        siti,
        `insert into support_messages (user_id, thread, sender, body)
         values ($1, 'admin', $2, 'hello') returning id`,
        [siti, sender]
      );
    expect(await send("customer")).toHaveLength(1);
    expect(await errorCode(send("ai"))).toBe(PERMISSION_DENIED);
    expect(await errorCode(send("seller"))).toBe(PERMISSION_DENIED);
  });

  it("lets the server store the assistant's reply", async () => {
    expect(
      await db.asService(
        `insert into support_messages (user_id, thread, sender, body)
         values ($1, 'admin', 'ai', 'How can I help?') returning id`,
        [siti]
      )
    ).toHaveLength(1);
    // The shopper reads their whole thread, the assistant's part included.
    expect(
      await db.asUser(siti, "select id from support_messages where thread = 'admin'")
    ).toHaveLength(2);
  });

  it("lets everyone signed in read stock, and only the server write it", async () => {
    await db.asService(
      "insert into listing_stock (listing_id, seller_farm, in_stock) values ('l1', 'Ladang Hijau', false)"
    );
    expect(await db.asUser(siti, "select in_stock from listing_stock")).toEqual([
      { in_stock: false },
    ]);
    expect(
      await errorCode(
        db.asUser(
          ahmad,
          "insert into listing_stock (listing_id, seller_farm) values ('l2', 'Ladang Hijau')"
        )
      )
    ).toBe(PERMISSION_DENIED);
    expect(
      await errorCode(db.asUser(bad, "update listing_stock set in_stock = true"))
    ).toBe(PERMISSION_DENIED);
  });
});

describe("size limits", () => {
  it("rejects oversized text", async () => {
    const long = "x".repeat(5000);
    expect(
      await errorCode(db.asUser(ahmad, "update farms set name = $1 where id = $2", [long, farm]))
    ).toBe(CHECK_VIOLATION);
    expect(
      await errorCode(
        db.asUser(
          ahmad,
          "insert into growth_logs (plant_id, event_type, note) values ($1, 'note', $2)",
          [plant, long]
        )
      )
    ).toBe(CHECK_VIOLATION);
    expect(
      await errorCode(
        db.asUser(
          siti,
          `insert into support_messages (user_id, thread, sender, body)
           values ($1, 'admin', 'customer', $2)`,
          [siti, long]
        )
      )
    ).toBe(CHECK_VIOLATION);
  });

  it("accepts normal text", async () => {
    expect(
      await db.asUser(
        ahmad,
        "insert into growth_logs (plant_id, event_type, note) values ($1, 'note', $2) returning id",
        [plant, "Leaves look good after the rain."]
      )
    ).toHaveLength(1);
  });
});

describe("scan credits are reserved in one atomic step", () => {
  const consume = async (user: string, limit: number | null) =>
    (await db.asService("select consume_scan_credit($1, $2) as r", [user, limit]))[0].r as {
      ok: boolean;
      reason?: string;
      usage_id?: string;
      from_bonus?: boolean;
      remaining?: number | null;
    };
  const bonusOf = async (user: string) =>
    (await db.admin("select bonus_scans from profiles where id = $1", [user]))[0]
      .bonus_scans as number;

  it("uses the monthly allowance first, then refuses", async () => {
    expect(await consume(bad, 2)).toMatchObject({ ok: true, from_bonus: false, remaining: 1 });
    expect(await consume(bad, 2)).toMatchObject({ ok: true, from_bonus: false, remaining: 0 });
    expect(await consume(bad, 2)).toEqual({ ok: false, reason: "out_of_credits" });
  });

  it("then uses purchased scans, and gives one back when a scan fails", async () => {
    expect((await db.asService("select add_bonus_scans($1, 2) as n", [bad]))[0].n).toBe(2);

    const third = await consume(bad, 2);
    expect(third).toMatchObject({ ok: true, from_bonus: true, remaining: 1 });
    expect(await bonusOf(bad)).toBe(1);

    await db.asService("select release_scan_credit($1, $2, $3)", [
      bad,
      third.usage_id,
      third.from_bonus,
    ]);
    expect(await bonusOf(bad)).toBe(2);
    // Releasing the same reservation twice must not mint a free scan.
    await db.asService("select release_scan_credit($1, $2, $3)", [
      bad,
      third.usage_id,
      third.from_bonus,
    ]);
    expect(await bonusOf(bad)).toBe(2);
  });

  it("never limits an unlimited plan", async () => {
    expect(await consume(ahmad, null)).toMatchObject({ ok: true, remaining: null });
  });

  it("cannot be called from the browser", async () => {
    expect(await errorCode(db.asUser(bad, "select add_bonus_scans($1, 1000)", [bad]))).toBe(
      PERMISSION_DENIED
    );
    expect(await errorCode(db.asUser(bad, "select consume_scan_credit($1, null)", [bad]))).toBe(
      PERMISSION_DENIED
    );
    expect(
      await errorCode(db.asUser(bad, "update profiles set bonus_scans = 1000 where id = $1", [bad]))
    ).toBe(PERMISSION_DENIED);
  });
});

describe("rate limit counter", () => {
  const take = async (key: string, max: number, seconds: number) =>
    (await db.asService("select take_rate_limit($1, $2, $3) as wait", [key, max, seconds]))[0]
      .wait as number;

  it("allows the first N requests in a window, then says how long to wait", async () => {
    expect([await take("k1", 2, 60), await take("k1", 2, 60)]).toEqual([0, 0]);
    const wait = await take("k1", 2, 60);
    expect(wait).toBeGreaterThan(0);
    expect(wait).toBeLessThanOrEqual(60);
    // Another person's counter is separate.
    expect(await take("k2", 2, 60)).toBe(0);
  });

  it("starts again when the window has passed", async () => {
    expect(await take("k3", 1, 1)).toBe(0);
    expect(await take("k3", 1, 1)).toBeGreaterThan(0);
    await db.admin("select pg_sleep(1.1)");
    expect(await take("k3", 1, 1)).toBe(0);
  });

  it("is server-only", async () => {
    expect(await errorCode(db.asUser(bad, "select take_rate_limit('k1', 1, 1)"))).toBe(
      PERMISSION_DENIED
    );
    expect(await errorCode(db.asUser(bad, "select * from rate_limits"))).toBe(PERMISSION_DENIED);
  });
});

describe("things that must keep working for a normal grower", () => {
  it("reads and manages only their own farm data", async () => {
    expect(await db.asUser(ahmad, "select id from farms")).toHaveLength(1);
    expect(await db.asUser(bad, "select id from plants where id = $1", [plant])).toHaveLength(0);
    expect(
      await db.asUser(bad, "update plants set name = 'x' where id = $1 returning id", [plant])
    ).toHaveLength(0);
    expect(
      await db.asUser(bad, "update plants set name = 'Mine' where id = $1 returning name", [
        badPlant,
      ])
    ).toEqual([{ name: "Mine" }]);
  });

  it("can only change the name on their own profile", async () => {
    expect(
      await db.asUser(ahmad, "update profiles set name = 'Ahmad B.' where id = $1 returning name", [
        ahmad,
      ])
    ).toEqual([{ name: "Ahmad B." }]);
    expect(
      await errorCode(
        db.asUser(ahmad, "update profiles set is_verified = true where id = $1", [ahmad])
      )
    ).toBe(PERMISSION_DENIED);
    expect(
      await errorCode(db.asUser(ahmad, "update profiles set plan = 'unlimited' where id = $1", [ahmad]))
    ).toBe(PERMISSION_DENIED);
  });

  it("deleting a plant removes its records (the cascade is not blocked)", async () => {
    await db.asUser(bad, "insert into growth_logs (plant_id, event_type) values ($1, 'water')", [
      badPlant,
    ]);
    await db.asUser(bad, "delete from plants where id = $1", [badPlant]);
    expect(
      await db.admin("select id from growth_logs where plant_id = $1", [badPlant])
    ).toHaveLength(0);
  });
});
