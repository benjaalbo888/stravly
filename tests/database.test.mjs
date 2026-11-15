import { before, after, test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const admin = "55a34895-41a0-4c4e-884a-64eabe00be9e";
const other = "48ad22d1-403b-41d1-9908-8a405c97e688";
let day, dateOffset, short, long;
const hash = (n) => n.toString(16).padStart(64, "0");

before(async () => {
  const file = (path) => readFile(new URL(path, import.meta.url), "utf8");
  await db.exec(await file("./auth-schema.sql"));
  await db.exec(await file("../supabase/migrations/20261114000100_stravly.sql"));
  ({ day, date_offset: dateOffset } = (await db.query(`
    select ((now() at time zone 'America/Santiago')::date + i)::text as day, i as date_offset
    from generate_series(1,7) i
    where extract(isodow from (now() at time zone 'America/Santiago')::date + i) between 1 and 5
    order by i limit 1`)).rows[0]);
  const { rows } = await db.query("select id, duration_minutes from public.services order by name");
  short = rows.find((row) => row.duration_minutes === 30).id;
  long = rows.find((row) => row.duration_minutes === 60).id;
  await db.query("insert into auth.users values ($1), ($2)", [admin, other]);
  await db.query("insert into administrators values ($1)", [admin]);
});
after(() => db.close());

async function as(role, user, fn) {
  return db.transaction(async (tx) => {
    await tx.exec(`set local role ${role}`);
    if (user) await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [user]);
    return fn(tx);
  });
}
async function slots(service = short, date = day) {
  const { rows } = await as("anon", null, (tx) => tx.query(
    "select starts_at::text as time from public.stravly_slots($1, $2)", [service, date]));
  return rows.map((row) => row.time);
}
async function book(time, service = short, bucket = 1) {
  const result = await as("service_role", null, (tx) => tx.query(
    "select public.stravly_book($1, $2, $3, $4, $5, $6) as result", [service, time, "Cliente Demo", "test@example.test", "+56900000000", hash(bucket)]));
  return result.rows[0].result;
}

test("RLS protects private records and public grants expose only supported operations", async () => {
  assert.equal((await as("anon", null, (tx) => tx.query("select name from services"))).rows.length, 3);
  assert.equal((await as("authenticated", other, (tx) => tx.query("select is_stravly_admin() as admin"))).rows[0].admin, false);
  assert.equal((await as("authenticated", admin, (tx) => tx.query("select is_stravly_admin() as admin"))).rows[0].admin, true);
  for (const table of ["bookings", "blocks", "administrators", "working_hours"]) {
    await assert.rejects(as("anon", null, (tx) => tx.query(`select * from public.${table}`)), { code: "42501" });
  }
  assert.equal((await as("authenticated", other, (tx) => tx.query("select * from bookings"))).rows.length, 0);
  await assert.rejects(as("authenticated", other, (tx) => tx.query("insert into public.services (name, duration_minutes, price_clp) values ('Demo',30,0)")), { code: "42501" });
  assert.equal((await as("anon", null, (tx) => tx.query("select has_function_privilege(current_user, 'public.stravly_book(uuid,timestamptz,text,text,text,text)', 'EXECUTE') as allowed"))).rows[0].allowed, false);
});

test("books a real slot, prevents overlap across services, and reopens a cancelled slot", async () => {
  const initial = await slots();
  const first = initial[0];
  const next = initial[1];
  const adjacent = initial[2];
  const payload = await book(first);
  assert.equal(payload.status, "confirmed");
  assert.match(payload.code, /^ST-[A-F0-9]{16}$/);
  assert.equal(payload.duration, 30);
  assert.equal(await book(first).then((r) => r.status), "unavailable");
  assert.equal(await book(next, long).then((r) => r.status), "unavailable");
  assert.equal((await slots()).includes(first), false);
  assert.equal((await slots()).includes(adjacent), true);
  const result = await as("authenticated", other, (tx) => tx.query("select customer_email from bookings"));
  assert.equal(result.rows.length, 0);
  const res = await as("authenticated", admin, (tx) => tx.query("select id, customer_email from bookings where code=$1", [payload.code]));
  assert.equal(res.rows[0].customer_email, "test@example.test");
  await assert.rejects(as("authenticated", admin, (tx) => tx.query(
    "select stravly_add_block($1,null,null,'Día libre')", [day])), { code: "23P01" });
  assert.equal((await as("authenticated", admin, (tx) => tx.query("update bookings set status='cancelled' where id=$1 returning status", [res.rows[0].id]))).rows[0].status, "cancelled");
  assert.equal((await slots()).includes(first), true);
});

test("honors service duration, inactive services, work hours and full or partial blocks", async () => {
  const baseline = await slots();
  const longBaseline = await slots(long);
  assert.equal(baseline.length - longBaseline.length, 2);
  assert.equal((await book(baseline.at(-1), long)).status, "unavailable");
  const { rows: [weekday] } = await db.query("select extract(isodow from $1::date) as day", [day]);
  await as("authenticated", admin, (tx) => tx.query("update working_hours set opens_at='11:00' where weekday=$1", [weekday.day]));
  assert.equal((await slots()).length, baseline.length - 4);
  const partial = await as("authenticated", admin, (tx) => tx.query("select stravly_add_block($1,'11:30','12:00','Pausa') as id", [day]));
  assert.equal((await slots()).length, baseline.length - 7);
  const full = await as("authenticated", admin, (tx) => tx.query("select stravly_add_block($1,null,null,'Día libre') as id", [day]));
  assert.deepEqual(await slots(), []);
  await as("authenticated", admin, (tx) => tx.query("delete from blocks where id in ($1,$2)", [partial.rows[0].id, full.rows[0].id]));
  const { rows: [created] } = await as("authenticated", admin, (tx) => tx.query(
    "insert into services (name,description,duration_minutes,price_clp) values('Demo','Prueba',45,2000) returning id"));
  await as("authenticated", admin, (tx) => tx.query("update services set active=false where id=$1 returning id", [created.id]));
  assert.deepEqual(await slots(created.id), []);
  assert.deepEqual((await as("anon", null, (tx) => tx.query("select id from services where id=$1", [created.id]))).rows, []);
  const { rows: [dates] } = await db.query(`
    select ((now() at time zone 'America/Santiago')::date - 1)::text as previous,
           ((now() at time zone 'America/Santiago')::date + 61)::text as beyond`);
  assert.ok(dateOffset > 0);
  assert.deepEqual(await slots(short, dates.previous), []);
  assert.deepEqual(await slots(short, dates.beyond), []);
});

test("limits repeated booking attempts in PostgreSQL", async () => {
  const stale = "2000-01-03 10:00:00+00";
  for (let i = 0; i < 12; i++) assert.equal((await book(stale, short, 2)).status, "unavailable");
  assert.equal((await book(stale, short, 2)).status, "limited");
  assert.equal((await book(stale, short, 3)).status, "unavailable");
});
