import assert from "node:assert/strict";
import { before, after, test } from "node:test";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
const a = "55a34895-41a0-4c4e-884a-64eabe00be9e";
const b = "66a34895-41a0-4c4e-884a-64eabe00be9e";
const c = "77a34895-41a0-4c4e-884a-64eabe00be9e";
const unconfirmed = "88a34895-41a0-4c4e-884a-64eabe00be9e";
let date, one, two, service, otherService, legacy;
const scalar = async (client, statement, args = []) => (await client.query(statement,args)).rows[0]?.value;
const acting = (role,user,fn) => db.transaction(async (tx) => {
  await tx.exec(`set local role ${role}`);
  await tx.query("select set_config('request.jwt.claim.sub',$1,true)",[user ?? ""]);
  return fn(tx);
});
const as = (user,statement,args) => acting("authenticated",user,tx => scalar(tx,statement,args));
const create = (user,slug) => as(user,"select create_business('Barbería de prueba',$1,'','Barbería','','+56900000000','hola@example.test','Profesional de prueba','10:00','18:00',array[1,2,3,4,5,6,7]) value",[slug]);
const slots = (slug,id,worker) => acting("anon",null,tx => tx.query("select starts_at::text as start from business_slots($1,$2,$3,$4)",[slug,id,worker,date]));
const book = (slug,id,worker,start,attempt = 1) => acting("service_role",null,tx => scalar(tx,
  "select book_business($1,$2,$3,$4,'Cliente Demo','demo@example.test','+56900000000',$5) value",[slug,id,worker,start,String(attempt).padStart(64,"0")]));
const hours = Array.from({length:7},(_,i) => ({ weekday:i+1, opens_at:"10:00", closes_at:"18:00", active:true }));

before(async () => {
  for (const file of ["./auth-schema.sql","../supabase/migrations/20261114000100_stravly.sql",
    "../supabase/migrations/20261115000100_multi_business.sql","../supabase/migrations/20261115000200_legacy_cutover.sql"]) {
    await db.exec(await readFile(new URL(file,import.meta.url),"utf8").then(async sql => {
      if (file.endsWith("multi_business.sql")) await db.exec("alter table auth.users add column email text, add column email_confirmed_at timestamptz");
      return sql;
    }));
  }
  await db.query("insert into auth.users values ($1,'owner1@example.test',now()),($2,'owner2@example.test',now()),($3,'team@example.test',now()),($4,'pending@example.test',null)",[a,b,c,unconfirmed]);
  date = await scalar(db,"select ((now() at time zone 'America/Santiago')::date+3)::text value");
  one = await create(a,"negocio-uno");
  two = await create(b,"negocio-dos");
  service = await as(a,"insert into business_services(business_id,name,duration_minutes,price_clp) values($1,'Corte de uno',30,2000) returning id value",[one]);
  otherService = await as(b,"insert into business_services(business_id,name,duration_minutes,price_clp) values($1,'Corte de dos',30,2000) returning id value",[two]);
  legacy = await scalar(db,`insert into bookings(service_id,service_name,price_clp,customer_name,customer_email,customer_phone,starts_at,ends_at)
     select id,name,price_clp,'Cliente Demo','demo@example.test','+56900000000',now()-interval '3 days',now()-interval '3 days'+interval '30 minutes'
     from services limit 1 returning to_jsonb(bookings) value`);
  await db.query("insert into administrators values ($1),($2)",[a,c]);
});
after(() => db.close());

test("cutover preserves the original reservation and accepts only an explicitly confirmed owner", async () => {
  await assert.rejects(scalar(db,"select stravly_private.import_estudio_norte($1) value",[unconfirmed]),{code:"22023"});
  const demo = await scalar(db,"select stravly_private.import_estudio_norte($1) value",[a]);
  const copied = await scalar(db,"select to_jsonb(b)-'business_id'-'worker_id' value from business_bookings b where id=$1",[legacy.id]);
  assert.deepEqual(copied,legacy);
  assert.equal(await as(c,"select business_role($1) value",[demo]),"admin");
  assert.equal(await as(a,"select business_role($1) value",[demo]),"owner");
  assert.equal(await scalar(db,"select w.name value from business_bookings b join workers w on w.id=b.worker_id where b.id=$1",[legacy.id]),"Agenda original");
  await assert.rejects(db.exec("update bookings set status='cancelled'"),{code:"55000"});
});

test("ownership is derived from Auth, and private rows and writes are scoped to membership", async () => {
  assert.equal(await as(a,"select business_role($1) value",[one]),"owner");
  assert.equal(await as(a,"select business_role($1) value",[two]),null);
  assert.equal(await as(a,"select count(*)::int value from business_services where business_id=$1",[two]),0);
  assert.equal(await as(a,"update business_services set name='No permitido' where business_id=$1 returning id value",[two]),undefined);
  await assert.rejects(as(a,"insert into business_members values($1,$2,'owner')",[two,a]),{code:"42501"});
  await assert.rejects(create(unconfirmed,"negocio-pendiente"),{code:"42501"});
  await assert.rejects(acting("anon",null,tx => tx.query("select customer_email from business_bookings")),{code:"42501"});
  await assert.rejects(as(a,"select invite_business_admin($1,'team@example.test') value",[two]),{code:"42501"});
});

test("invitation is private, one-use, tied to the verified email, and grants only admin", async () => {
  const invite = await as(a,"select invite_business_admin($1,'team@example.test') value",[one]);
  assert.match(invite,/^[a-f0-9]{64}$/);
  assert.equal(await as(b,"select accept_business_invite($1) value",[invite]),null);
  assert.equal(await as(c,"select accept_business_invite($1) value",[invite]),one);
  assert.equal(await as(c,"select accept_business_invite($1) value",[invite]),null);
  assert.equal(await as(c,"select business_role($1) value",[one]),"admin");
  await assert.rejects(as(c,"select remove_business_access($1,$2,false) value",[one,a]),{code:"42501"});
  await assert.rejects(as(c,"select save_business_hours($1,null,$2::jsonb) value",[one,JSON.stringify(hours)]),{code:"42501"});
  await as(a,"select remove_business_access($1,$2,false) value",[one,c]);
  assert.equal(await as(c,"select business_role($1) value",[one]),null);
  const old = await as(a,"select invite_business_admin($1,'team@example.test') value",[one]);
  await db.query("update stravly_private.business_invites set expires_at=now()-interval '1 second' where business_id=$1",[one]);
  assert.equal(await as(c,"select accept_business_invite($1) value",[old]),null);
});

test("independent professionals can book simultaneously, while each agenda rejects overlapping appointments", async () => {
  const w1 = await as(a,"select id value from workers where business_id=$1",[one]);
  const w2 = await as(a,"insert into workers(business_id,name) values($1,'Segundo profesional') returning id value",[one]);
  const w3 = await as(b,"select id value from workers where business_id=$1",[two]);
  await as(a,"select save_business_hours($1,$2,$3::jsonb) value",[one,w2,JSON.stringify(hours)]);
  for (const [owner,business,w,s] of [[a,one,w1,service],[a,one,w2,service],[b,two,w3,otherService]]) {
    await as(owner,"select assign_worker_services($1,$2,$3::uuid[]) value",[business,w,[s]]);
  }
  await assert.rejects(as(a,"select assign_worker_services($1,$2,$3::uuid[]) value",[one,w1,[otherService]]),{code:"23503"});
  const available = await slots("negocio-uno",service,w1);
  assert.equal(available.rows.length,31);
  const {start} = available.rows[0];
  assert.equal((await book("negocio-uno",service,w1,start)).status,"confirmed");
  assert.equal((await book("negocio-uno",service,w1,available.rows[1].start)).status,"unavailable");
  const second = await book("negocio-uno",service,null,start);
  assert.equal(second.worker,"Segundo profesional");
  assert.equal((await book("negocio-dos",otherService,w3,start)).status,"confirmed");
  assert.equal(await as(a,"select count(*)::int value from business_bookings where business_id=$1",[two]),0);
  assert.equal((await slots("negocio-uno",otherService,w3)).rows.length,0);
  await assert.rejects(as(a,"select add_business_block($1,$2,$3,'10:00','10:30','Pausa') value",[one,w1,date]),{code:"23P01"});
  await as(a,"select add_business_block($1,$2,$3,'11:00','11:30','Pausa') value",[one,w1,date]);
  assert.ok((await slots("negocio-uno",service,w2)).rows.length > (await slots("negocio-uno",service,w1)).rows.length);
});
