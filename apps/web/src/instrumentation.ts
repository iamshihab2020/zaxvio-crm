export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createConsola } = await import("consola");
    const { getClientEnv, validateEnv } = await import("./lib/env");

    const logger = createConsola({
      formatOptions: { date: false },
    });

    // Fail fast: a missing or malformed value stops the server here rather than
    // surfacing as a silent localhost fallback or a mid-request crash.
    let warnings: string[] = [];
    try {
      warnings = validateEnv().warnings;
    } catch (error) {
      logger.error(error instanceof Error ? error.message : String(error));
      logger.error("Copy apps/web/.env.example to apps/web/.env.local and fill in the values.");
      throw error;
    }

    const isDev = process.env.NODE_ENV !== "production";
    const envLabel = isDev ? "⚠ development" : "✔ production";
    const apiUrl = getClientEnv().NEXT_PUBLIC_API_URL;

    const bannerLines = [
      "",
      "🌐  Zaxvio CRM — Web Client",
      "",
      `⚙️   Environment     ${envLabel}`,
      `🖥️   App              http://localhost:3000`,
      `🔗  API              ${apiUrl}`,
      `🎨  Framework        Next.js 14 (App Router)`,
      `🔐  Auth             Better Auth ✓`,
      "",
      "📦  Route Groups",
      "  🏠  (landing)          Public landing page",
      "  🔑  (auth)             Login, signup, forgot password",
      "  📊  (dashboard)        Tenant app (jobs, customers, invoices...)",
      "  👑  (superadmin)       Admin panel",
      "  📅  book/[slug]        Public booking portal",
      "",
      "⚡  Web client ready",
      "",
    ];

    logger.box(bannerLines.join("\n"));

    for (const warning of warnings) {
      logger.warn(warning);
    }
  }
}
