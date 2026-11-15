import "server-only";

export function publicConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key?.startsWith("sb_publishable_")) return null;
  try {
    const parsed = new URL(url);
    if (parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) return null;
    if (parsed.protocol !== "https:" && !(parsed.protocol === "http:" && ["127.0.0.1", "localhost"].includes(parsed.hostname))) return null;
  } catch { return null; }
  return { url, key };
}

export function bookingConfig() {
  const config = publicConfig();
  const key = process.env.SUPABASE_SECRET_KEY;
  return config && key?.startsWith("sb_secret_") ? { ...config, key } : null;
}

export const sessionCookie = {
  httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/",
};
