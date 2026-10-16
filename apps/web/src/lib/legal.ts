/**
 * Facts the Privacy Policy and Terms of Service are built from (LAND-05).
 *
 * Both pages were drafted on 2026-10-16 from what the code actually does, not
 * from a template, and they need a legal review before launch. Change the
 * pages when any of these facts change: a new place data is sent, a new
 * cookie, a different retention period.
 */

/** Shown at the top of both pages. Update it whenever either page changes. */
export const LEGAL_LAST_UPDATED = "2026-10-16";

/**
 * Where privacy requests and questions about the terms go. **Unset on
 * purpose.** There is no public support address yet, and a made-up one is
 * worse than none, so the pages say plainly that it is not published yet.
 * Set this to a monitored inbox before launch; both pages pick it up.
 */
export const LEGAL_CONTACT_EMAIL: string | null = null;

/**
 * Every service that receives personal data, and why. Read off the codebase:
 * `DATABASE_URL` (Neon), `render.yaml` (the API), the Vercel deployment and
 * `@vercel/speed-insights`, `lib/storage.ts` (R2), `lib/email.ts` (Resend) and
 * `app/api/chat/route.ts` (Groq). Lemon Squeezy is absent because billing is
 * not built; add it here the day it is.
 */
export const DATA_PROCESSORS = [
  {
    name: "Neon",
    role: "Database",
    what: "Everything stored in your workspace: your account, your business settings and the records you create.",
  },
  {
    name: "Render",
    role: "Application server",
    what: "Runs the part of Zaxvio that reads and writes your data, so every request passes through it.",
  },
  {
    name: "Vercel",
    role: "Website hosting and performance measurement",
    what: "Serves the website and app. Speed Insights records how fast pages load, without cookies.",
  },
  {
    name: "Cloudflare R2",
    role: "File storage",
    what: "Job photos and attachments, business logos, and quote PDFs.",
  },
  {
    name: "Resend",
    role: "Email delivery",
    what: "The emails Zaxvio sends: to you, to your team, and to your customers in your business's name.",
  },
  {
    name: "Groq",
    role: "Help assistant",
    what: "What you type into the in-app help assistant, with the last few messages of that conversation, to produce a reply.",
  },
] as const;
