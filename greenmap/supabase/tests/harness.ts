import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

/*
 * A real Postgres (PGlite — Postgres compiled to run inside Node) with every
 * migration applied, so the database rules can be tested the way a browser
 * hits them: as the `authenticated` role, with a user id in the session.
 *
 * Supabase adds schemas of its own (`auth`, `storage`) and three roles. They
 * are stubbed below with only the parts the migrations and policies use.
 * This tests OUR rules; it is not a copy of Supabase.
 */

const MIGRATIONS_DIR = fileURLToPath(new URL("../migrations/", import.meta.url));

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;

  -- Supabase gives its API roles access to everything in "public"; Row Level
  -- Security and the REVOKEs in the migrations are what narrow it down.
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables    to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;

  create schema auth;
  grant usage on schema auth to anon, authenticated, service_role;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;

  create schema storage;
  grant usage on schema storage to anon, authenticated, service_role;
  create table storage.buckets (
    id text primary key,
    name text not null,
    public boolean not null default false,
    file_size_limit bigint,
    allowed_mime_types text[]
  );
  create table storage.objects (
    id uuid primary key default gen_random_uuid(),
    bucket_id text references storage.buckets (id),
    name text not null,
    owner_id text,
    unique (bucket_id, name)
  );
  alter table storage.objects enable row level security;
  grant all on storage.buckets, storage.objects to anon, authenticated, service_role;
  create function storage.foldername(name text) returns text[] language sql immutable as $$
    select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1]
  $$;
`;

export function migrationFiles(): string[] {
  return readdirSync(MIGRATIONS_DIR)
    .filter((file) => file.endsWith(".sql"))
    .sort();
}

export function readMigration(file: string): string {
  return readFileSync(MIGRATIONS_DIR + file, "utf8");
}

export type Row = Record<string, unknown>;

export class TestDatabase {
  private constructor(private readonly db: PGlite) {}

  /**
   * A fresh database with the Supabase stubs and the migrations applied
   * (all of them unless a shorter list is given).
   */
  static async create(files: string[] = migrationFiles()): Promise<TestDatabase> {
    const db = new PGlite({ extensions: { pgcrypto } });
    await db.exec(SUPABASE_STUB);
    const test = new TestDatabase(db);
    for (const file of files) await test.applyMigration(file);
    return test;
  }

  async applyMigration(file: string): Promise<void> {
    try {
      await this.db.exec(readMigration(file));
    } catch (cause) {
      throw new Error(`migration ${file} failed: ${(cause as Error).message}`, { cause });
    }
  }

  async close(): Promise<void> {
    await this.db.close();
  }

  /** Run SQL as the database owner (setting up test data). */
  async admin(sql: string, params: unknown[] = []): Promise<Row[]> {
    return (await this.db.query<Row>(sql, params)).rows;
  }

  /** Run SQL the way the server does with the service-role key. */
  async asService(sql: string, params: unknown[] = []): Promise<Row[]> {
    return this.withRole("service_role", "", sql, params);
  }

  /** Run SQL the way a signed-in browser does. */
  async asUser(userId: string, sql: string, params: unknown[] = []): Promise<Row[]> {
    return this.withRole("authenticated", userId, sql, params);
  }

  /** Run SQL the way a signed-out browser does. */
  async asAnon(sql: string, params: unknown[] = []): Promise<Row[]> {
    return this.withRole("anon", "", sql, params);
  }

  /** Create a signed-up user (the 0002 trigger adds the profile row). */
  async createUser(email: string): Promise<string> {
    const [row] = await this.admin(
      "insert into auth.users (email, raw_user_meta_data) values ($1, $2) returning id",
      [email, JSON.stringify({ name: email.split("@")[0], role: "grower" })]
    );
    return row.id as string;
  }

  private async withRole(
    role: string,
    userId: string,
    sql: string,
    params: unknown[]
  ): Promise<Row[]> {
    await this.db.query("select set_config('request.jwt.claim.sub', $1, false)", [userId]);
    await this.db.exec(`set role ${role}`);
    try {
      return (await this.db.query<Row>(sql, params)).rows;
    } finally {
      await this.db.exec("reset role");
    }
  }
}
