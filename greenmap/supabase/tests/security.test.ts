import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sharedRuleTests } from "./shared-rules";
import {
  PERMISSION_DENIED,
  TOO_MANY,
  createWorld,
  errorCode,
  migrationFiles,
  type World,
} from "./harness";

/*
 * The database with EVERY migration applied — the state the app is built
 * for. Farm data is read-only for the browser here (0011); the server
 * writes it after checking the request.
 */

let world: World;

beforeAll(async () => {
  world = await createWorld();
}, 60_000);

afterAll(async () => {
  await world.db.close();
});

describe("migrations", () => {
  it("can all be run a second time (they say they are safe to re-run)", async () => {
    for (const file of migrationFiles()) await world.db.applyMigration(file);
  });
});

sharedRuleTests(() => world);

describe("farm data is read-only for the browser (0011)", () => {
  it("refuses every direct write to farms, zones, plants and the care log", async () => {
    const { db, ahmad, farm, plant } = world;
    const attempts: [string, string, unknown[]][] = [
      [
        "create a farm",
        "insert into farms (user_id, name, location, crop_type) values ($1, 'New', 'Johor', 'Chili')",
        [ahmad],
      ],
      ["rename a farm", "update farms set name = 'Renamed' where id = $1", [farm]],
      ["delete a farm", "delete from farms where id = $1", [farm]],
      ["add a zone", "insert into zones (farm_id, name) values ($1, 'North')", [farm]],
      ["add a plant", "insert into plants (farm_id, name, type) values ($1, 'P', 'Chili')", [farm]],
      ["change a plant's status", "update plants set manual_status = 'healthy' where id = $1", [plant]],
      ["move a plant to another date", "update plants set plant_date = '2001-01-01' where id = $1", [plant]],
      ["delete a plant", "delete from plants where id = $1", [plant]],
      ["log watering", "insert into growth_logs (plant_id, event_type) values ($1, 'water')", [plant]],
    ];
    for (const [label, sql, params] of attempts) {
      expect(await errorCode(db.asUser(ahmad, sql, params)), label).toBe(PERMISSION_DENIED);
    }
  });

  it("still lets the grower read all of it", async () => {
    const { db, ahmad, farm } = world;
    await db.asService("insert into zones (farm_id, name) values ($1, 'North')", [farm]);
    for (const table of ["farms", "zones", "plants", "growth_logs"]) {
      expect((await db.asUser(ahmad, `select id from ${table}`)).length, table).toBeGreaterThan(0);
    }
  });

  it("still lets the grower manage 360° photos and tags of their own farm", async () => {
    const { db, ahmad, bad, farm, plant } = world;
    const addPanorama = (user: string) =>
      db.asUser(
        user,
        `insert into farm_panoramas (farm_id, image_url, position_x, position_y)
         values ($1, 'https://x/p.jpg', 0.5, 0.5) returning id`,
        [farm]
      );
    const [panorama] = await addPanorama(ahmad);
    expect(await errorCode(addPanorama(bad))).toBe(PERMISSION_DENIED);
    expect(
      await db.asUser(
        ahmad,
        `insert into panorama_plant_tags (panorama_id, plant_id, yaw, pitch)
         values ($1, $2, 0.1, 0.2) returning id`,
        [panorama.id, plant]
      )
    ).toHaveLength(1);
    expect(
      await db.asUser(ahmad, "update farm_panoramas set heading_deg = 40 where id = $1 returning id", [
        panorama.id,
      ])
    ).toHaveLength(1);
  });
});

describe("row limits on the tables the browser still writes (0011)", () => {
  const ask = (user: string, n: number) =>
    world.db.asUser(
      user,
      `insert into refund_requests (user_id, order_ref, farm, kind)
       values ($1, $2, 'Some Farm', 'refund') returning id`,
      [user, `GM-${n}`]
    );

  it("allows 30 refund requests in 10 minutes, and refuses the 31st", async () => {
    const flooder = await world.db.createUser("flooder@test.local");
    for (let n = 1; n <= 30; n++) await ask(flooder, n);
    expect(await errorCode(ask(flooder, 31))).toBe(TOO_MANY);
    expect(
      await world.db.admin("select count(*)::int as n from refund_requests where user_id = $1", [
        flooder,
      ])
    ).toEqual([{ n: 30 }]);

    // Somebody else is not affected.
    const calm = await world.db.createUser("calm@test.local");
    expect(await ask(calm, 1)).toHaveLength(1);
  });

  it("cannot be reset by calling the limit function directly", async () => {
    const { db } = world;
    const flooder = (
      await db.admin("select id from auth.users where email = 'flooder@test.local'")
    )[0].id as string;
    // The function takes no "max" or "window": calling it only counts again.
    expect(
      await errorCode(db.asUser(flooder, "select take_client_write_limit('refund_requests')"))
    ).toBe(TOO_MANY);
    expect(await errorCode(ask(flooder, 32))).toBe(TOO_MANY);
  });

  it("does not limit the server", async () => {
    const { db, siti } = world;
    await db.asService(
      `insert into support_messages (user_id, thread, sender, body)
       select $1, 'admin', 'ai', 'reply ' || n from generate_series(1, 200) as n`,
      [siti]
    );
    expect(
      (
        await db.admin(
          "select count(*)::int as n from support_messages where user_id = $1 and sender = 'ai'",
          [siti]
        )
      )[0].n
    ).toBeGreaterThanOrEqual(200);
  });

  it("covers every table the browser can insert into", async () => {
    const limited = await world.db.admin(
      `select c.relname as table_name
       from pg_trigger t join pg_class c on c.oid = t.tgrelid
       where t.tgname = 'limit_client_writes' order by 1`
    );
    expect(limited.map((row) => row.table_name)).toEqual([
      "farm_panoramas",
      "order_feedback",
      "panorama_plant_tags",
      "refund_requests",
      "support_messages",
    ]);

    // And nothing else in "public" is insertable by the browser at all —
    // neither by permission nor by policy. A new table that the browser may
    // insert into must be added to the limits (and to this list).
    const byPermission = await world.db.admin(
      `select table_name from information_schema.role_table_grants
       where grantee = 'authenticated' and table_schema = 'public' and privilege_type = 'INSERT'
       order by 1`
    );
    const byPolicy = await world.db.admin(
      `select distinct tablename from pg_policies
       where schemaname = 'public' and cmd in ('INSERT', 'ALL') order by 1`
    );
    const limitedTables = limited.map((row) => row.table_name);
    expect(byPermission.map((row) => row.table_name)).toEqual(limitedTables);
    expect(byPolicy.map((row) => row.tablename)).toEqual(limitedTables);
  });
});
