/**
 * Where the Fastify API actually lives, from this server's point of view.
 *
 * In production `NEXT_PUBLIC_API_URL` is this app's own origin so that browser
 * traffic stays same-origin (see src/lib/api-url.ts for why the session cookie
 * requires that). The rewrites below are what actually carry those requests to
 * the API, so they need the real address — and falling back to
 * `NEXT_PUBLIC_API_URL` here would make them point at this app, i.e. an
 * infinite loop. Fail the build instead of shipping that.
 */
const apiOrigin = process.env.API_INTERNAL_URL ?? "http://localhost:4000";

if (
  process.env.NODE_ENV === "production" &&
  !process.env.API_INTERNAL_URL
) {
  throw new Error(
    "API_INTERNAL_URL is required for production builds — it is the upstream " +
      "for the /api/auth and /events rewrites. Set it to the Fastify API's " +
      "public URL (e.g. https://zaxvio-api.onrender.com).",
  );
}

/** @type {import('next').NextConfig} */
const config = {
  async rewrites() {
    return [
      // Better Auth. The browser must see these as first-party or the session
      // cookie is dropped by Safari and Firefox.
      { source: "/api/auth/:path*", destination: `${apiOrigin}/api/auth/:path*` },
      // Server-sent events. EventSource sends credentials, so it has the same
      // first-party requirement as auth.
      { source: "/events", destination: `${apiOrigin}/events` },
      // The one dashboard component that fetches the API straight from the
      // browser (asset-service-history-tab). No page route lives here.
      {
        source: "/equipment/:id/history",
        destination: `${apiOrigin}/equipment/:id/history`,
      },
    ];
  },
  experimental: {
    staleTimes: {
      dynamic: 0,
    },
    // Required on Next.js 14 for src/instrumentation.ts to run at boot.
    // Without it register() is never called and env validation is dead code.
    instrumentationHook: true,
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          { key: "X-DNS-Prefetch-Control", value: "on" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default config;
