import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { setTimeout } from "node:timers/promises";
import pg from "pg";

const url = process.env.STRAVLY_TEST_DATABASE_URL;
const admin = "55a34895-41a0-4c4e-884a-64eabe00be9e";

test("two independent PostgreSQL connections cannot reserve overlapping intervals", async () => {
  assert.ok(url, "Define STRAVLY_TEST_DATABASE_URL para un clúster PostgreSQL descartable.");
  const { hostname, pathname } = new URL(url);
  assert.ok(["127.0.0.1", "localhost", "[::1]"].includes(hostname), "Usa un clúster PostgreSQL local.");
  assert.equal(pathname, "/stravly_test", "Usa exclusivamente la base vacía stravly_test.");
  const pool = new pg.Pool({ connectionString: url, max: 3, statement_timeout: 10000 });
  let a, b;
  try {
    const { rows: [guard] } = await pool.query(`
      select to_regnamespace('auth') as auth, to_regclass('public.business') as business,
        exists(select 1 from pg_roles where rolname in ('anon','authenticated','service_role')) as has_roles`);
    assert.deepEqual(guard, { auth: null, business: null, has_roles: false }, "Se necesita un clúster de prueba nuevo, sin esquemas ni roles de Supabase.");
    for (const file of ["./auth-schema.sql", "../supabase/migrations/20261114000100_stravly.sql"]) {
      await pool.query(await readFile(new URL(file, import.meta.url), "utf8"));
    }
    await pool.query("insert into auth.users values ($1)", [admin]);
    await pool.query("insert into administrators values ($1)", [admin]);
    const { rows: [day] } = await pool.query(`
      select ((now() at time zone 'America/Santiago')::date + i)::text as date
      from generate_series(1,7) i
      where extract(isodow from (now() at time zone 'America/Santiago')::date + i) between 1 and 5
      order by i limit 1`);
    const { rows: services } = await pool.query("select id, duration_minutes from services");
    const short = services.find((s) => s.duration_minutes === 30).id;
    const long = services.find((s) => s.duration_minutes === 60).id;
    const { rows: slots } = await pool.query("select starts_at from stravly_slots($1,$2)", [short, day.date]);
    const slot = (index) => slots[index].starts_at.toISOString();
    const book = (conn, service, start, client) => conn.query(
      "select stravly_book($1,$2,'Cliente Demo','demo@example.test','+56900000000',$3) as result",
      [service, start, client.toString(16).padStart(64, "0")]).then((r) => r.rows[0].result.status);

    a = await pool.connect();
    b = await pool.connect();
    const { rows: [{ pid }] } = await b.query("select pg_backend_pid() as pid");
    async function blocked() {
      for (let i = 0; i < 80; i++) {
        const { rows: [row] } = await pool.query("select cardinality(pg_blocking_pids($1)) as locks", [pid]);
        if (row.locks) return;
        await setTimeout(25);
      }
      assert.fail("La segunda conexión no esperó el bloqueo de la primera.");
    }
    async function race(firstIndex, secondIndex, secondService) {
      await a.query("begin");
      assert.equal(await book(a, short, slot(firstIndex), 1), "confirmed");
      const contender = book(b, secondService, slot(secondIndex), 2);
      try { await blocked(); } finally { await a.query("commit"); }
      assert.equal(await contender, "unavailable");
    }

    await race(0, 0, short); // same time and service
    await race(4, 3, long);  // different start time and duration
    assert.equal(await book(b, short, slot(6), 2), "confirmed"); // exact adjacency

    await a.query("begin");
    assert.equal(await book(a, short, slot(10), 1), "confirmed");
    await b.query("begin");
    await b.query("set local role authenticated");
    await b.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
    const blockingAttempt = b.query("select stravly_add_block($1,'12:30','13:00','Prueba')", [day.date]).catch((error) => error);
    try { await blocked(); } finally { await a.query("commit"); }
    assert.equal((await blockingAttempt).code, "23P01");
    await b.query("rollback");

    await a.query("begin");
    await a.query("set local role authenticated");
    await a.query("select set_config('request.jwt.claim.sub',$1,true)", [admin]);
    await a.query("select stravly_add_block($1,'13:30','14:00','Prueba')", [day.date]);
    const blockedBooking = book(b, short, slot(14), 2);
    try { await blocked(); } finally { await a.query("commit"); }
    assert.equal(await blockedBooking, "unavailable");

    assert.equal((await pool.query("select count(*)::int as total from bookings")).rows[0].total, 4);

    await pool.query("alter table auth.users add column email text, add column email_confirmed_at timestamptz");
    await pool.query("update auth.users set email='demo@example.test',email_confirmed_at=now() where id=$1",[admin]);
    await pool.query(await readFile(new URL("../supabase/migrations/20261115000100_multi_business.sql",import.meta.url),"utf8"));
    const { rows:[business] } = await pool.query("insert into businesses(slug,name) values('race-test','Prueba') returning id");
    const { rows: team } = await pool.query("insert into workers(business_id,name) values($1,'Primero'),($1,'Segundo') returning id",[business.id]);
    const { rows:[item] } = await pool.query("insert into business_services(business_id,name,duration_minutes,price_clp) values($1,'Servicio',30,2500) returning id",[business.id]);
    await pool.query("insert into business_hours select $1,d,'10:00','18:00',true from generate_series(1,7) d",[business.id]);
    for (const worker of team) {
      await pool.query("insert into worker_hours select $1,$2,d,'10:00','18:00',true from generate_series(1,7) d",[business.id,worker.id]);
      await pool.query("insert into worker_services values($1,$2,$3)",[business.id,worker.id,item.id]);
    }
    const bookWorker = (conn, worker, pos, hash) => conn.query(
      "select book_business('race-test',$1,$2,$3,'Cliente Demo','demo@example.test','+56900000000',$4) result",
      [item.id,worker,slot(pos),hash.toString().padStart(64,"0")]).then(r => r.rows[0].result);
    await a.query("begin");
    assert.equal((await bookWorker(a,team[0].id,0,20)).status,"confirmed");
    const exactWorker = bookWorker(b,team[0].id,0,21);
    try { await blocked(); } finally { await a.query("commit"); }
    assert.equal((await exactWorker).status,"unavailable");
    await a.query("begin");
    assert.equal((await bookWorker(a,team[0].id,3,22)).worker,"Primero");
    const anyWorker = bookWorker(b,null,3,23);
    try { await blocked(); } finally { await a.query("commit"); }
    assert.equal((await anyWorker).worker,"Segundo");
  } finally {
    // Roll back only these two test connections, including if an assertion failed.
    if (a) { await a.query("rollback"); a.release(); }
    if (b) { await b.query("rollback"); b.release(); }
    await pool.end();
  }
});
