import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { demoBookingEnabled, publicConfig, sessionCookie } from "@/lib/supabase/env";

export async function proxy(request: NextRequest) {
  const path = request.nextUrl.pathname;
  const multi = process.env.STRAVLY_MULTI_BUSINESS === "1";
  if (multi) {
    if (path === "/reservar") {
      return demoBookingEnabled() ? NextResponse.redirect(new URL("/b/estudio-norte", request.url)) : NextResponse.next();
    }
    if (path === "/admin/login") return NextResponse.redirect(new URL("/login", request.url));
    if (path === "/admin" || path.startsWith("/admin/")) return NextResponse.redirect(new URL("/dashboard", request.url));
  } else if (!path.startsWith("/admin") && path !== "/reservar") {
    return NextResponse.redirect(new URL("/", request.url));
  }
  let response = NextResponse.next({ request });
  const config = publicConfig();
  if (!config) return response;

  const client = createServerClient(config.url, config.key, {
    cookieOptions: sessionCookie,
    cookies: {
      encode: "tokens-only",
      getAll: () => request.cookies.getAll(),
      setAll: (cookies, headers) => {
        cookies.forEach(({ name, value }) => request.cookies.set(name, value));
        const previous = response;
        response = NextResponse.next({ request });
        previous.cookies.getAll().forEach((cookie) => response.cookies.set(cookie));
        cookies.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        Object.entries(headers).forEach(([name, value]) => response.headers.set(name, value));
      },
    },
  });
  await client.auth.getClaims();
  response.headers.set("Cache-Control", "private, no-store");
  return response;
}

export const config = { matcher: ["/admin/:path*", "/reservar", "/b/:path*", "/dashboard/:path*", "/crear-negocio", "/login", "/registro", "/confirmar", "/invitacion"] };
