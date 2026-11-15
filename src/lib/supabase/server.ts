import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { publicConfig, sessionCookie } from "./env";

const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: "no-store" });

export function dataClient(config = publicConfig()) {
  if (!config) return null;
  return createClient(config.url, config.key, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: noStoreFetch },
  });
}

export async function sessionClient(writable = false) {
  const config = publicConfig();
  if (!config) return null;
  const jar = await cookies();
  return createServerClient(config.url, config.key, {
    cookieOptions: sessionCookie,
    global: { fetch: noStoreFetch },
    cookies: {
      encode: "tokens-only",
      getAll: () => jar.getAll(),
      setAll: (values) => {
        if (!writable) return;
        values.forEach(({ name, value, options }) => jar.set(name, value, options));
      },
    },
  });
}

export async function adminClient() {
  const client = await sessionClient();
  if (!client) return null;
  const { data: identity, error } = await client.auth.getClaims();
  if (error || !identity?.claims?.sub) return null;
  const { data } = await client.rpc("is_stravly_admin");
  return data === true ? client : null;
}
