import { createConsola } from "consola";
import { env, isPlaceholderEmail } from "./env.js";
import { isStorageConfigured } from "./storage.js";

const logger = createConsola({
  formatOptions: { date: false },
});

const ROUTES = [
  "/tenants",
  "/customers",
  "/tags",
  "/catalog",
  "/jobs",
  "/checklists",
  "/pipeline-stages",
  "/invoices",
  "/quotes",
  "/dashboard",
  "/availability",
  "/public/booking",
  "/bookings",
  "/calendar-events",
  "/equipment",
  "/maintenance-contracts",
  "/admin",
  "/notifications",
] as const;

export function printStartupBanner(startTime: bigint) {
  const elapsed = Number(process.hrtime.bigint() - startTime) / 1e6;
  const isDev = process.env.NODE_ENV !== "production";
  const envLabel = isDev ? "⚠ development" : "✔ production";

  // Build route list in columns of 3
  const routeLines: string[] = [];
  for (let i = 0; i < ROUTES.length; i += 3) {
    const chunk = ROUTES.slice(i, i + 3);
    routeLines.push("  " + chunk.map((r) => r.padEnd(22)).join(""));
  }

  const emailStatus = !env.RESEND_API_KEY
    ? "⚠ Not configured"
    : isPlaceholderEmail(env.RESEND_FROM_EMAIL)
      ? `⚠ Resend key OK, but sender "${env.RESEND_FROM_EMAIL}" is a placeholder — sends will fail`
      : `Resend ✓ (${env.RESEND_FROM_EMAIL})`;

  const bannerLines = [
    "",
    "🚀  Zaxvio CRM — API Server",
    "",
    `⚙️   Environment     ${envLabel}`,
    `🌐  Server           http://localhost:${env.PORT}`,
    `📚  API Docs          http://localhost:${env.PORT}/docs`,
    `🔗  CORS              ${env.FRONTEND_URL}`,
    `🔐  Auth              Better Auth ✓`,
    `📧  Email             ${emailStatus}`,
    `📦  Storage           ${isStorageConfigured() ? "Cloudflare R2 ✓" : "⚠ R2 not configured — uploads will fail"}`,
    `📡  Realtime          SSE at /events ✓`,
    "",
    `📦  Routes (${ROUTES.length})`,
    ...routeLines,
    "",
    `🩺  Health            GET /health`,
    "",
    `⚡  Ready in ${elapsed.toFixed(0)}ms — listening on port ${env.PORT}`,
    "",
  ];

  logger.box(bannerLines.join("\n"));
}

export function printShutdownMessage(signal: string) {
  logger.warn(`⏹️  ${signal} received — shutting down gracefully...`);
}

export function printCronStarted(jobs: string[]) {
  logger.success(`⏰  Cron Jobs started: ${jobs.join(", ")}`);
}
