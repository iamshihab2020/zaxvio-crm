import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/book",
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

function isSuperadminPath(pathname: string) {
  return pathname.startsWith("/superadmin");
}

function isDashboardPath(pathname: string) {
  return (
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/customers") ||
    pathname.startsWith("/jobs") ||
    pathname.startsWith("/invoices") ||
    pathname.startsWith("/quotes") ||
    pathname.startsWith("/bookings") ||
    pathname.startsWith("/schedule") ||
    pathname.startsWith("/catalog") ||
    pathname.startsWith("/checklists") ||
    pathname.startsWith("/settings")
  );
}

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
    // Match all paths except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
