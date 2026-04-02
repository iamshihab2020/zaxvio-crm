export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { createConsola } = await import("consola");

    const logger = createConsola({
      formatOptions: { date: false },
    });

    const isDev = process.env.NODE_ENV !== "production";
    const envLabel = isDev ? "⚠ development" : "✔ production";
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

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
  }
}
