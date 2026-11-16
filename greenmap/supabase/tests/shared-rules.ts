import { beforeAll, describe, expect, it } from "vitest";
import {
  CHECK_VIOLATION,
  PERMISSION_DENIED,
  UNIQUE_VIOLATION,
  errorCode,
  newFarm,
  type World,
} from "./harness";

/*
 * Rules that must hold in every state a real database can be in: with
 * migration 0010 alone, and with 0011 on top. Each test file builds its
 * database and calls `sharedRuleTests`, then adds what is special to it.
 *
 * Each test is an attack (or a normal action that must keep working). The
 * browser is the `authenticated` role; the server is `service_role`.
 */

const SCAN = "https://x.supabase.co/storage/v1/object/public/plant-scans/p/1.jpg";

export function sharedRuleTests(world: () => World) {
  describe("storage: only the uploader can replace or delete a file", () => {
    const upload = (user: string, name: string) =>
      world().db.asUser(
        user,
        `insert into storage.objects (bucket_id, name, owner_id) values ('plant-scans', $1, $2)
         on conflict (bucket_id, name) do update set owner_id = excluded.owner_id
         returning name`,
        [name, user]
      );

    it("lets a signed-in user upload a new file (upsert on a new path)", async () => {
      expect(await upload(world().ahmad, "p/1.jpg")).toHaveLength(1);
    });

    it("stops another account from overwriting or deleting it", async () => {
      const { db, bad } = world();
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
      const { db, ahmad } = world();
      expect(await upload(ahmad, "p/1.jpg")).toHaveLength(1);
      expect(
        await db.asUser(ahmad, "delete from storage.objects where name = 'p/1.jpg' returning name")
      ).toHaveLength(1);
    });

    it("limits every bucket to images of a bounded size", async () => {
      const buckets = await world().db.admin(
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
    it("lets the server set the score", async () => {
      const { db, plant } = world();
      const [row] = await db.asService(
        "update plants set health_score = 82 where id = $1 returning health_score",
        [plant]
      );
      expect(row.health_score).toBe(82);
    });

    it("does not let the browser set the score or the harvested flag", async () => {
      const { db, ahmad, plant } = world();
      // Ignored (0010) or refused (0011) — either way nothing changes.
      await db
        .asUser(
          ahmad,
          "update plants set health_score = 100, lifecycle_status = 'harvested' where id = $1",
          [plant]
        )
        .catch(() => {});
      expect(
        await db.admin("select health_score, lifecycle_status from plants where id = $1", [plant])
      ).toEqual([{ health_score: 82, lifecycle_status: "active" }]);
    });

    it("refuses AI scans, score history and passports written by the browser", async () => {
      const { db, ahmad, plant, farm } = world();
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

    it("refuses AI-scan and harvest events, edits and deletes in the care log", async () => {
      const { db, ahmad, plant } = world();
      const [log] = await db.asService(
        "insert into growth_logs (plant_id, event_type) values ($1, 'water') returning id",
        [plant]
      );
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
      expect(
        await errorCode(
          db.asUser(ahmad, "update growth_logs set note = 'edited' where id = $1", [log.id])
        )
      ).toBe(PERMISSION_DENIED);
      expect(
        await errorCode(db.asUser(ahmad, "delete from growth_logs where id = $1", [log.id]))
      ).toBe(PERMISSION_DENIED);
      // The owner still reads the record.
      expect(await db.asUser(ahmad, "select id from growth_logs where id = $1", [log.id])).toHaveLength(1);
    });

    it("lets the server write a passport that the owner can read and nobody can list", async () => {
      const { db, ahmad, bad, plant, farm } = world();
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
      const { db, plant } = world();
      expect(
        await errorCode(
          db.asService(
            "insert into ai_analyses (plant_id, image_url, diagnosis) values ($1, $2, 'Again')",
            [plant, SCAN]
          )
        )
      ).toBe(UNIQUE_VIOLATION);
    });
  });

  describe("seller name: a later farm cannot take over a name in use", () => {
    let refund: string;

    beforeAll(async () => {
      const { db, siti, bad } = world();
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
      // The attacker makes a second farm with the seller's name.
      await newFarm(db, bad, "Ladang Hijau");
    });

    it("shows the seller inbox to the first owner of the name only", async () => {
      const { db, ahmad, bad } = world();
      for (const table of ["refund_requests", "support_messages", "order_feedback"]) {
        expect(await db.asUser(ahmad, `select id from ${table}`), table).toHaveLength(1);
        expect(await db.asUser(bad, `select id from ${table}`), table).toHaveLength(0);
      }
    });

    it("does not let the copycat decide the refund or answer as the seller", async () => {
      const { db, bad, siti } = world();
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

    it("starts a new claim when a farm is renamed, however old the farm is", async () => {
      const { db, bad, badFarm } = world();
      // badFarm is older than this rename, but its claim on the name is not.
      await db.asService("update farms set name = 'Ladang Hijau' where id = $1", [badFarm]);
      expect(await db.asUser(bad, "select id from refund_requests")).toHaveLength(0);
      await db.asService("update farms set name = 'Kebun Lain' where id = $1", [badFarm]);
    });

    it("does not let a shopper approve their own refund", async () => {
      const { db, siti } = world();
      // Siti opens a request against a farm name that she then registers herself.
      const [own] = await db.asUser(
        siti,
        `insert into refund_requests (user_id, order_ref, item, farm, kind)
         values ($1, 'GM-X', 'Chili', 'Kebun Siti Sendiri', 'refund') returning id`,
        [siti]
      );
      await newFarm(db, siti, "Kebun Siti Sendiri");
      expect(
        await db.asUser(
          siti,
          "update refund_requests set status = 'approved' where id = $1 returning id",
          [own.id]
        )
      ).toHaveLength(0);
    });

    it("does not let a shopper start a request that is already approved", async () => {
      const { db, siti } = world();
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
      const { db, ahmad, siti } = world();
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
      const { db, farm } = world();
      const [row] = await db.asService(
        `update farms set name_claimed_at = '2020-01-01T00:00:00Z' where id = $1
         returning name_claimed_at < now() - interval '1 year' as old`,
        [farm]
      );
      expect(row.old).toBe(true);
    });

    it("passes the name to the next farm when the first owner's farm is deleted", async () => {
      const { db } = world();
      const spare = await db.createUser("spare@test.local");
      const other = await db.createUser("other@test.local");
      const first = await newFarm(db, spare, "Dusun Bersama");
      await newFarm(db, other, "Dusun Bersama");
      const owns = async (user: string) =>
        (await db.asUser(user, "select owns_seller_name('Dusun Bersama') as yes"))[0].yes;

      expect([await owns(spare), await owns(other)]).toEqual([true, false]);
      await db.asService("delete from farms where id = $1", [first]);
      expect(await owns(other)).toBe(true);
    });
  });

  describe("support chat and stock", () => {
    it("lets a shopper write as the customer only", async () => {
      const { db, siti } = world();
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
      const { db, siti } = world();
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
      const { db, ahmad, bad, siti } = world();
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
    it("rejects oversized text, whoever writes it", async () => {
      const { db, siti, farm, plant } = world();
      const long = "x".repeat(5000);
      expect(
        await errorCode(db.asService("update farms set name = $1 where id = $2", [long, farm]))
      ).toBe(CHECK_VIOLATION);
      expect(
        await errorCode(
          db.asService(
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
      const { db, plant } = world();
      expect(
        await db.asService(
          "insert into growth_logs (plant_id, event_type, note) values ($1, 'note', $2) returning id",
          [plant, "Leaves look good after the rain."]
        )
      ).toHaveLength(1);
    });
  });

  describe("scan credits are reserved in one atomic step", () => {
    const consume = async (user: string, limit: number | null) =>
      (await world().db.asService("select consume_scan_credit($1, $2) as r", [user, limit]))[0]
        .r as {
        ok: boolean;
        reason?: string;
        usage_id?: string;
        from_bonus?: boolean;
        remaining?: number | null;
      };
    const bonusOf = async (user: string) =>
      (await world().db.admin("select bonus_scans from profiles where id = $1", [user]))[0]
        .bonus_scans as number;

    it("uses the monthly allowance first, then refuses", async () => {
      const { bad } = world();
      expect(await consume(bad, 2)).toMatchObject({ ok: true, from_bonus: false, remaining: 1 });
      expect(await consume(bad, 2)).toMatchObject({ ok: true, from_bonus: false, remaining: 0 });
      expect(await consume(bad, 2)).toEqual({ ok: false, reason: "out_of_credits" });
    });

    it("then uses purchased scans, and gives one back when a scan fails", async () => {
      const { db, bad } = world();
      expect((await db.asService("select add_bonus_scans($1, 2) as n", [bad]))[0].n).toBe(2);

      const third = await consume(bad, 2);
      expect(third).toMatchObject({ ok: true, from_bonus: true, remaining: 1 });
      expect(await bonusOf(bad)).toBe(1);

      const release = () =>
        db.asService("select release_scan_credit($1, $2, $3)", [
          bad,
          third.usage_id,
          third.from_bonus,
        ]);
      await release();
      expect(await bonusOf(bad)).toBe(2);
      // Releasing the same reservation twice must not mint a free scan.
      await release();
      expect(await bonusOf(bad)).toBe(2);
    });

    it("never limits an unlimited plan", async () => {
      expect(await consume(world().ahmad, null)).toMatchObject({ ok: true, remaining: null });
    });

    it("cannot be called from the browser", async () => {
      const { db, bad } = world();
      expect(await errorCode(db.asUser(bad, "select add_bonus_scans($1, 1000)", [bad]))).toBe(
        PERMISSION_DENIED
      );
      expect(await errorCode(db.asUser(bad, "select consume_scan_credit($1, null)", [bad]))).toBe(
        PERMISSION_DENIED
      );
      expect(
        await errorCode(
          db.asUser(bad, "update profiles set bonus_scans = 1000 where id = $1", [bad])
        )
      ).toBe(PERMISSION_DENIED);
    });
  });

  describe("rate limit counter", () => {
    const take = async (key: string, max: number, seconds: number) =>
      (
        await world().db.asService("select take_rate_limit($1, $2, $3) as wait", [
          key,
          max,
          seconds,
        ])
      )[0].wait as number;

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
      await world().db.admin("select pg_sleep(1.1)");
      expect(await take("k3", 1, 1)).toBe(0);
    });

    it("is server-only", async () => {
      const { db, bad } = world();
      expect(await errorCode(db.asUser(bad, "select take_rate_limit('k1', 1, 1)"))).toBe(
        PERMISSION_DENIED
      );
      expect(await errorCode(db.asUser(bad, "select * from rate_limits"))).toBe(PERMISSION_DENIED);
    });
  });

  describe("reading: each grower sees only their own farm data", () => {
    it("shows a grower their farms and plants, and nobody else's", async () => {
      const { db, ahmad, bad, plant, badPlant } = world();
      expect(await db.asUser(ahmad, "select id from plants where id = $1", [plant])).toHaveLength(1);
      expect(await db.asUser(bad, "select id from plants where id = $1", [plant])).toHaveLength(0);
      expect(await db.asUser(bad, "select id from plants where id = $1", [badPlant])).toHaveLength(1);
      expect(await db.asAnon("select id from farms")).toHaveLength(0);
      expect(await db.asAnon("select id from plants")).toHaveLength(0);
    });

    it("lets a user change only the name on their own profile", async () => {
      const { db, ahmad } = world();
      expect(
        await db.asUser(
          ahmad,
          "update profiles set name = 'Ahmad B.' where id = $1 returning name",
          [ahmad]
        )
      ).toEqual([{ name: "Ahmad B." }]);
      expect(
        await errorCode(
          db.asUser(ahmad, "update profiles set is_verified = true where id = $1", [ahmad])
        )
      ).toBe(PERMISSION_DENIED);
      expect(
        await errorCode(
          db.asUser(ahmad, "update profiles set plan = 'unlimited' where id = $1", [ahmad])
        )
      ).toBe(PERMISSION_DENIED);
    });
  });
}
