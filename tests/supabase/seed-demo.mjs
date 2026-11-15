import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";

const api = process.env.SUPABASE_URL;
const db = process.env.DB_URL;
assert.equal(new URL(api ?? "https://invalid.example").href,"http://127.0.0.1:54321/");
assert.ok(db, "Ejecuta Supabase CLI en localhost y carga DB_URL.");
const dbUrl = new URL(db);
assert.equal(dbUrl.hostname,"127.0.0.1");
assert.equal(dbUrl.port,"54322");
const email = "demo-owner@example.test";
const auth = createClient(api,process.env.SUPABASE_SECRET_KEY,{ auth:{persistSession:false,autoRefreshToken:false} });
const {data,error} = await auth.auth.admin.createUser({email,password:crypto.randomUUID(),email_confirm:true});
assert.ok(!error && data.user?.id, "No se pudo crear la cuenta ficticia en el Auth local.");
const client = new pg.Client({connectionString:db});
await client.connect();
try {
  const {rows:[booking]} = await client.query(`
    insert into public.bookings(service_id,service_name,price_clp,customer_name,customer_email,customer_phone,starts_at,ends_at)
    select id,name,price_clp,'Persona Demo','legacy@example.test','+56900000000',
      now()-interval '3 days',now()-interval '3 days'+interval '30 minutes' from public.services limit 1
    returning id,code`);
  await client.query("insert into public.administrators values($1)",[data.user.id]);
  await client.query("select stravly_private.import_estudio_norte($1)",[data.user.id]);
  const {rows:[migrated]} = await client.query("select id,code from public.business_bookings where id=$1",[booking.id]);
  assert.deepEqual(migrated,booking);
} finally {
  await client.end();
}
