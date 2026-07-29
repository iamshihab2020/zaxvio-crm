/**
 * Server-side base URL for the Fastify API.
 *
 * There are two different URLs for the same API, and which one you want depends
 * on *who is making the request*:
 *
 *   • The browser must reach the API **same-origin**, because Better Auth's
 *     session cookie is set by the API. If the browser called
 *     `https://api.onrender.com` directly from `https://app.vercel.app`, that
 *     cookie would be third-party — Safari and Firefox drop those silently, so
 *     sign-in appears to succeed and the session never persists. Browser traffic
 *     therefore goes to `NEXT_PUBLIC_API_URL`, which in production is this app's
 *     own origin, and `next.config.mjs` rewrites `/api/auth/*` and `/events`
 *     through to the real API.
 *
 *   • Server actions and route handlers have no cookie policy to satisfy — they
 *     forward the cookie header by hand. Sending them through the public rewrite
 *     would make the Next server call itself over the internet to reach a
 *     service it can address directly, so they use `API_INTERNAL_URL`.
 *
 * Falling back to `NEXT_PUBLIC_API_URL` keeps local development a single
 * variable: both point at `http://localhost:4000` and nothing needs configuring.
 */
export const API_URL =
  process.env.API_INTERNAL_URL ??
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";
