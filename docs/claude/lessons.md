# Lessons Learned

Non-obvious insights, patterns, and mistakes worth remembering. Split by topic for maintainability.

## Index

| File | Topics | Lessons |
|------|--------|---------|
| [lessons/backend-stack.md](lessons/backend-stack.md) | Drizzle ORM, Supabase, Fastify, Zod schemas | 28 |
| [lessons/auth-flow.md](lessons/auth-flow.md) | Better Auth + Fastify integration, auth flow, org plugin | 16 |
| [lessons/frontend-nextjs.md](lessons/frontend-nextjs.md) | Next.js 14, UI/UX patterns, react-big-calendar, charts, animations, AI SDK | 40 |
| [lessons/booking-availability.md](lessons/booking-availability.md) | Booking portal, availability, public quote acceptance | 20 |
| [lessons/tenant-security.md](lessons/tenant-security.md) | Tenant init/settings, security hardening, multi-pipeline | 12 |
| [lessons/jobs-customers.md](lessons/jobs-customers.md) | Job API audit, customer-to-job flow, dual-view page | 20 |
| [lessons/features-misc.md](lessons/features-misc.md) | Equipment/assets, file uploads, conversations, bulk ops, maintenance | 22 |

## Rules

- **When to add**: After ANY user correction, hard-won debugging insight, library gotcha, or non-obvious pattern. If it cost >5 minutes, it's a lesson.
- **When to update**: If an existing lesson is outdated or wrong, update or remove it.
- **Format**: Group by topic. Each bullet: bold the takeaway, then explain why. Keep it specific and actionable.
- **Not for code patterns**: Don't log things derivable from reading the code. Log the *surprise*.
- **Review at session start**: Always skim relevant lesson files before starting work to avoid repeating past mistakes.
