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
  // Optional: the chatbot route degrades to a friendly error when unset.
  GROQ_API_KEY: optionalString(z.string().min(1)),
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
      GROQ_API_KEY: process.env.GROQ_API_KEY,
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

  // A frontend pointed at its own origin instead of the API is a silent 404 factory.
  if (client.NEXT_PUBLIC_API_URL === server.FRONTEND_URL) {
    warnings.push(
      `NEXT_PUBLIC_API_URL and FRONTEND_URL are both "${server.FRONTEND_URL}" — the API should run on a different origin.`,
    );
  }

  return { warnings };
}
