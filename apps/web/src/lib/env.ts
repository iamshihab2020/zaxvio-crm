import { z } from "zod";

/**
 * Environment validation for the Next.js app.
 *
 * Next.js only loads `.env*` files from `apps/web` — it never reads the
 * monorepo root `.env` (that one belongs to apps/api + packages/database).
 * Everything the frontend needs lives in `apps/web/.env.local`.
 *
 * `validateEnv()` runs once at server boot from `instrumentation.ts`, so a
 * missing or malformed value stops the server with a readable message instead
 * of silently falling back to localhost or throwing deep inside a request.
 */

/**
 * `KEY=` in a .env file arrives as `""`, not `undefined`, so a bare
 * `.optional()` would reject a deliberately blank optional var. Treat blank
 * as unset — .env.example ships these keys empty.
 */
function optionalString<T extends z.ZodTypeAny>(schema: T) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() === "" ? undefined : value),
    schema.optional(),
  );
}

/**
 * Browser-visible config. `NEXT_PUBLIC_*` values are inlined at build time,
 * which is why each one MUST be referenced as a literal `process.env.X` below —
 * a dynamic lookup like `process.env[key]` is not substituted by the compiler
 * and resolves to `undefined` in the client bundle.
 */
const clientSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url("NEXT_PUBLIC_API_URL must be a valid URL"),
  // Public R2 bucket base URL, used to render job photos and tenant logos.
  // Optional so the app runs before R2 is provisioned — images render blank.
  NEXT_PUBLIC_R2_PUBLIC_URL: optionalString(
    z.string().url("NEXT_PUBLIC_R2_PUBLIC_URL must be a valid URL"),
  ),
});

/** Server-only config. Never prefixed `NEXT_PUBLIC_` — must stay out of the browser bundle. */
const serverSchema = z.object({
  FRONTEND_URL: z.string().url("FRONTEND_URL must be a valid URL"),
  /**
   * The Fastify API's real address, used by server actions and by the
   * `/api/auth` + `/events` rewrites in next.config.mjs. Distinct from
   * `NEXT_PUBLIC_API_URL`, which in production is this app's own origin so the
   * browser's session cookie stays first-party — see lib/api-url.ts.
   * Optional: unset means single-origin local development.
   */
  API_INTERNAL_URL: optionalString(z.string().url("API_INTERNAL_URL must be a valid URL")),
  // Optional: the chatbot route degrades to a friendly error when unset.
  GROQ_API_KEY: optionalString(z.string().min(1)),
  /**
   * Shared secret with the API. When set (and matching `INTERNAL_PROXY_SECRET`
   * in the root `.env`), the public booking server actions forward the visitor's
   * IP so the API rate-limits per customer instead of lumping every visitor into
   * this server's single bucket (BOOK-02).
   */
  INTERNAL_PROXY_SECRET: optionalString(z.string().min(16)),
});

export type ClientEnv = z.infer<typeof clientSchema>;
export type ServerEnv = z.infer<typeof serverSchema>;

function describeIssues(error: z.ZodError): string {
  return error.issues.map((issue) => `  • ${issue.path.join(".")}: ${issue.message}`).join("\n");
}

function parseClientEnv(): ClientEnv {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_R2_PUBLIC_URL: process.env.NEXT_PUBLIC_R2_PUBLIC_URL,
  });

  if (!parsed.success) {
    throw new Error(
      `Invalid public environment variables (apps/web/.env.local):\n${describeIssues(parsed.error)}`,
    );
  }

  return parsed.data;
}

let cachedClientEnv: ClientEnv | null = null;
let cachedServerEnv: ServerEnv | null = null;

/** Validated `NEXT_PUBLIC_*` config. Safe to call from client or server code. */
export function getClientEnv(): ClientEnv {
  if (!cachedClientEnv) {
    cachedClientEnv = parseClientEnv();
  }
  return cachedClientEnv;
}

/** Validated server-only config. Throws if reached from browser code. */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must not be called from client components");
  }

  if (!cachedServerEnv) {
    const parsed = serverSchema.safeParse({
      FRONTEND_URL: process.env.FRONTEND_URL,
      API_INTERNAL_URL: process.env.API_INTERNAL_URL,
      GROQ_API_KEY: process.env.GROQ_API_KEY,
      INTERNAL_PROXY_SECRET: process.env.INTERNAL_PROXY_SECRET,
    });

    if (!parsed.success) {
      throw new Error(
        `Invalid server environment variables (apps/web/.env.local):\n${describeIssues(parsed.error)}`,
      );
    }

    cachedServerEnv = parsed.data;
  }

  return cachedServerEnv;
}

/**
 * Boot-time gate called from `instrumentation.ts`. Validates both halves and
 * returns a short warning list for non-fatal misconfigurations.
 */
export function validateEnv(): { warnings: string[] } {
  const client = getClientEnv();
  const server = getServerEnv();
  const warnings: string[] = [];

  if (!server.GROQ_API_KEY) {
    warnings.push("GROQ_API_KEY is not set — the AI chatbot is disabled.");
  }

  if (!server.INTERNAL_PROXY_SECRET) {
    warnings.push(
      "INTERNAL_PROXY_SECRET is not set — the API rate-limits public booking traffic by this server's IP, so all visitors share one budget.",
    );
  }

  // In production the browser is *meant* to see the API at this app's own
  // origin, with next.config.mjs rewriting /api/auth and /events upstream —
  // that is what keeps Better Auth's session cookie first-party. The rewrites
  // need API_INTERNAL_URL to know where upstream is, so same-origin without it
  // is a silent 404 factory: every sign-in would hit this app's 404 page.
  const sameOrigin = client.NEXT_PUBLIC_API_URL === server.FRONTEND_URL;

  if (sameOrigin && !server.API_INTERNAL_URL) {
    warnings.push(
      `NEXT_PUBLIC_API_URL and FRONTEND_URL are both "${server.FRONTEND_URL}" but API_INTERNAL_URL is not set — the /api/auth and /events rewrites have no upstream, so sign-in will 404.`,
    );
  }

  // The inverse mistake: pointing the browser straight at a different host.
  // Works locally, but on real domains the session cookie becomes third-party
  // and Safari and Firefox drop it — sign-in "succeeds" and never persists.
  const isLocal = client.NEXT_PUBLIC_API_URL.startsWith("http://localhost");
  if (!sameOrigin && !isLocal) {
    warnings.push(
      `NEXT_PUBLIC_API_URL ("${client.NEXT_PUBLIC_API_URL}") differs from FRONTEND_URL ("${server.FRONTEND_URL}") — the browser will call the API cross-site and Safari/Firefox will drop the session cookie. Set NEXT_PUBLIC_API_URL to FRONTEND_URL and put the API address in API_INTERNAL_URL instead.`,
    );
  }

  return { warnings };
}
