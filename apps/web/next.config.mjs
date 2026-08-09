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
  /**
   * Workspace packages that ship raw TypeScript and export RUNTIME values.
   *
   * `@hvac-saas/types` is not listed because it is types only — the imports are
   * erased before anything has to resolve them. `@hvac-saas/workflow-nodes`
   * exports the node registry, the limits and the variable table as real
   * values, so Next has to compile it.
   */
  transpilePackages: ["@hvac-saas/workflow-nodes"],

  /**
   * Let webpack resolve an ESM-style `./foo.js` specifier to `./foo.ts`.
   *
   * `packages/workflow-nodes` writes its internal imports with explicit `.js`
   * extensions — 93 of them across 26 files. That is correct for the API, which
   * runs the raw TypeScript through `tsx`, and it type-checks fine under the
   * repo's `moduleResolution: "bundler"`, where the extension is permitted but
   * not required. Webpack is the one consumer that takes the specifier
   * literally, looks for a `.js` file that was never emitted, and fails with
   * "Can't resolve './node-definition.js'".
   *
   * Fixed here rather than by stripping the extensions, because this is one
   * line against 93 edits in files nothing has type-checked yet — and a single
   * typo in that sweep would break every consumer of the package at once.
   *
   * `.js` stays last in the list so a genuine `.js` file in `node_modules`
   * still resolves normally after the TypeScript candidates miss.
   *
   * Worth knowing if the toolchain changes: this is a **webpack** option. Moving
   * to `next dev --turbo` would need Turbopack's own `resolveExtensions`, and
   * the honest fix at that point is to drop the extensions in the package so
   * every bundler agrees without configuration.
   */
  webpack: (config) => {
    config.resolve.extensionAlias = {
      ...config.resolve.extensionAlias,
      ".js": [".ts", ".tsx", ".js"],
    };
    return config;
  },

  async rewrites() {
    return [
      // Better Auth. The browser must see these as first-party or the session
      // cookie is dropped by Safari and Firefox.
      { source: "/api/auth/:path*", destination: `${apiOrigin}/api/auth/:path*` },
      // Server-sent events. EventSource sends credentials, so it has the same
      // first-party requirement as auth.
      { source: "/events", destination: `${apiOrigin}/events` },
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
