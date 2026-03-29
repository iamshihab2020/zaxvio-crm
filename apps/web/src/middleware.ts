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
    pathname.startsWith("/settings")
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  // Read role cookie (set at login, cleared at logout)
  const roleCookie = request.cookies.get("x-user-role")?.value;
  const isAdmin = roleCookie === "admin";

  // ── Logged-in user routing ──────────────────────────────
  if (sessionCookie) {
    // Redirect logged-in users away from auth pages
    if (isAuthPath(pathname)) {
      const target = isAdmin ? "/superadmin/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(target, request.url));
    }

    // Redirect logged-in users away from landing page (prevents back-button to /)
    if (pathname === "/") {
      const target = isAdmin ? "/superadmin/dashboard" : "/dashboard";
      return NextResponse.redirect(new URL(target, request.url));
    }

    // Block non-admins from superadmin paths (fast heuristic before layout check)
    if (isSuperadminPath(pathname) && !isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Redirect admins away from dashboard paths to superadmin
    if (isDashboardPath(pathname) && isAdmin) {
      return NextResponse.redirect(new URL("/superadmin/dashboard", request.url));
    }

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
