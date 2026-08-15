import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/book",
  "/quote",
  "/ref",
];

const authPaths = ["/login", "/signup"];

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

function isAuthPath(pathname: string) {
  return authPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

// `isSuperadminPath` and `isDashboardPath` used to live here and had no callers.
// They are not restored on purpose: the only thing middleware could do with them
// is gate on a role, and the role it can see is a client-set cookie. That check
// belongs in the (superadmin) layout, server-side, which is where it is —
// security-rules §3. A path predicate sitting unused next to a session check is
// an invitation to reintroduce exactly that.

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  // ── Logged-in user routing ──────────────────────────────
  // Note: Admin role verification happens server-side in the superadmin layout,
  // NOT via a client-set cookie (which would be forgeable).
  if (sessionCookie) {
    // Redirect logged-in users away from auth pages
    if (isAuthPath(pathname)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Redirect logged-in users away from landing page
    if (pathname === "/") {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Superadmin access is enforced server-side in the (superadmin) layout.
    // Middleware only checks that a session exists — no role cookie trust.

    return NextResponse.next();
  }

  // ── Not logged in ────���──────────────────────────────────
  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Redirect to login with callback URL
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("callbackUrl", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals, static files, and the paths
    // that next.config.mjs proxies through to the Fastify API.
    //
    // Those proxied paths MUST be excluded. Middleware runs before rewrites, so
    // without this the redirect above fires first and an unauthenticated
    // request to /api/auth/sign-up/email is answered with a 307 to /login
    // instead of reaching the API — sign-in and sign-up become impossible, and
    // the browser sees a login page where it expected JSON.
    //
    // This only became reachable when browser traffic moved to the same origin.
    // Previously these calls went straight to the API's own domain, where
    // Next.js middleware never saw them.
    "/((?!_next/static|_next/image|favicon.ico|api/auth|events|equipment/[^/]+/history|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
