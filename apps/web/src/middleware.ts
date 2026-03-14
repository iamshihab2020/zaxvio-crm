import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const publicPaths = [
  "/login",
  "/signup",
  "/forgot-password",
  "/book",
  "/ref",
];

function isPublicPath(pathname: string) {
  if (pathname === "/") return true;
  return publicPaths.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname)) {
    return NextResponse.next();
  }

  // Check for Better Auth session cookie
  const sessionCookie =
    request.cookies.get("better-auth.session_token") ??
    request.cookies.get("__Secure-better-auth.session_token");

  if (!sessionCookie) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and static files
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
