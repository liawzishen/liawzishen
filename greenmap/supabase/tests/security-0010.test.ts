import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sharedRuleTests } from "./shared-rules";
import {
  CHECK_VIOLATION,
  PERMISSION_DENIED,
  createWorld,
  errorCode,
  migrationFiles,
  type World,
} from "./harness";

/*
 * A database with migrations up to 0010 — the state between "0010 applied"
 * and "0011 applied". The browser still writes farms, plants and care logs
 * here, so the guards of 0010 are what protects the trusted columns. 0011
 * later takes those writes away, and these guards stay as a second lock.
 */

let world: World;

beforeAll(async () => {
  world = await createWorld(migrationFiles().filter((file) => file < "0011"));
}, 60_000);

afterAll(async () => {
  await world.db.close();
});

sharedRuleTests(() => world);

describe("0010 guards on browser writes", () => {
  it("ignores a health score, a harvested flag and a back-date on a new plant", async () => {
    const { db, ahmad, farm } = world;
    const [row] = await db.asUser(
      ahmad,
      `insert into plants (farm_id, name, type, health_score, lifecycle_status, created_at)
       values ($1, 'Cheat', 'Tomato', 100, 'harvested', '2001-01-01')
       returning health_score, lifecycle_status, created_at > now() - interval '1 minute' as fresh`,
      [farm]
    );
    expect(row).toEqual({ health_score: null, lifecycle_status: "active", fresh: true });
  });

  it("saves the grower's own status while leaving the server columns alone", async () => {
    const { db, ahmad, plant } = world;
    const before = await db.admin("select health_score from plants where id = $1", [plant]);
    const [updated] = await db.asUser(
      ahmad,
      `update plants set health_score = 1, lifecycle_status = 'harvested', manual_status = 'healthy'
       where id = $1 returning health_score, lifecycle_status, manual_status`,
      [plant]
    );
    expect(updated).toEqual({
      health_score: before[0].health_score,
      lifecycle_status: "active",
      manual_status: "healthy",
    });
  });

  it("lets the grower add care events to their own plants only", async () => {
    const { db, ahmad, bad, plant } = world;
    expect(
      await db.asUser(
        ahmad,
        "insert into growth_logs (plant_id, event_type) values ($1, 'water') returning id",
        [plant]
      )
    ).toHaveLength(1);
    expect(
      await errorCode(
        db.asUser(bad, "insert into growth_logs (plant_id, event_type) values ($1, 'water')", [
          plant,
        ])
      )
    ).toBe(PERMISSION_DENIED);
  });

  it("does not accept a back-dated care event", async () => {
    const { db, ahmad, plant } = world;
    const [log] = await db.asUser(
      ahmad,
      `insert into growth_logs (plant_id, event_type, created_at)
       values ($1, 'fertilize', '2001-01-01')
       returning created_at > now() - interval '1 minute' as fresh`,
      [plant]
    );
    expect(log.fresh).toBe(true);
  });

  it("does not let a copycat farm look older than the seller's", async () => {
    const { db, bad, badFarm } = world;
    // A new farm with the seller's name, claiming to be from 2001.
    await db.asUser(
      bad,
      `insert into farms (user_id, name, location, crop_type, created_at, name_claimed_at)
       values ($1, 'Ladang Hijau', 'Johor', 'Tomato', '2001-01-01', '2001-01-01')`,
      [bad]
    );
    // An old farm of theirs, renamed to the seller's name and back-dated.
    await db.asUser(
      bad,
      `update farms set name = 'Ladang Hijau', name_claimed_at = '2001-01-01', created_at = '2001-01-01'
       where id = $1`,
      [badFarm]
    );
    expect(
      (await db.asUser(bad, "select owns_seller_name('Ladang Hijau') as yes"))[0].yes
    ).toBe(false);
    const [row] = await db.admin(
      `select created_at > now() - interval '1 day' as created_kept,
              name_claimed_at > now() - interval '1 hour' as claim_is_new
       from farms where id = $1`,
      [badFarm]
    );
    expect(row).toEqual({ created_kept: true, claim_is_new: true });
    await db.asUser(bad, "update farms set name = 'Kebun Lain' where id = $1", [badFarm]);
  });

  it("applies the size limits to browser writes", async () => {
    const { db, ahmad, farm } = world;
    expect(
      await errorCode(
        db.asUser(ahmad, "update farms set name = $1 where id = $2", ["x".repeat(5000), farm])
      )
    ).toBe(CHECK_VIOLATION);
  });

  it("keeps a grower inside their own farm, and lets a delete cascade", async () => {
    const { db, bad, plant, badPlant } = world;
    expect(
      await db.asUser(bad, "update plants set name = 'x' where id = $1 returning id", [plant])
    ).toHaveLength(0);
    await db.asUser(bad, "insert into growth_logs (plant_id, event_type) values ($1, 'water')", [
      badPlant,
    ]);
    await db.asUser(bad, "delete from plants where id = $1", [badPlant]);
    expect(
      await db.admin("select id from growth_logs where plant_id = $1", [badPlant])
    ).toHaveLength(0);
  });
});
