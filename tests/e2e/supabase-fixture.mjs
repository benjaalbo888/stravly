// Test-only REST adapter for the migrated PostgreSQL database. It does not emulate Auth.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";

const db = new PGlite();
for (const file of ["../auth-schema.sql", "../../supabase/migrations/20261114000100_stravly.sql"]) {
  await db.exec(await readFile(new URL(file, import.meta.url), "utf8"));
}
const routes = {
  "GET /rest/v1/business": ["anon", "select name from business", []],
  "GET /rest/v1/services": ["anon", "select * from services order by price_clp", []],
  "POST /rest/v1/rpc/stravly_slots": ["anon", "select starts_at from stravly_slots($1,$2)", ["p_service", "p_date"]],
  "POST /rest/v1/rpc/stravly_book": ["service_role", "select stravly_book($1,$2,$3,$4,$5,$6) as booking", [
    "p_service", "p_start", "p_name", "p_email", "p_phone", "p_client_hash",
  ]],
};
const server = createServer(async (req, res) => {
  const send = (status, data) => {
    res.writeHead(status, { "content-type": "application/json" });
    res.end(JSON.stringify(data));
  };
  const { pathname } = new URL(req.url, "http://127.0.0.1");
  if (pathname === "/health") return send(200, { status: "ok" });
  const route = routes[`${req.method} ${pathname}`];
  if (!route) return send(404, { message: "Route not implemented in the local fixture" });
  const [role, query, params] = route;
  const expected = role === "anon" ? "sb_publishable_stravly_fixture_only" : "sb_secret_stravly_fixture_only";
  if (req.headers.apikey !== expected) return send(401, { message: "Unexpected fixture role" });
  try {
    let payload = {};
    if (params.length) {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      payload = JSON.parse(Buffer.concat(chunks).toString());
    }
    const { rows } = await db.transaction(async (tx) => {
      await tx.exec(`set local role ${role}`);
      return tx.query(query, params.map((field) => payload[field]));
    });
    if (role === "service_role") return send(200, rows[0].booking);
    return send(200, pathname.endsWith("/business") ? rows[0] : rows);
  } catch (error) {
    // Metadata only; test inputs need not be printed.
    return send(500, { code: error.code ?? "fixture_error", message: "Local database request failed" });
  }
});
server.listen(54123, "127.0.0.1");
