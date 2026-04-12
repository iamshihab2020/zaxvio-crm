# Strict Rules (MUST FOLLOW)

1. **All migration SQL must be idempotent** — use `IF NOT EXISTS`, `IF EXISTS`, `ON CONFLICT DO NOTHING`. See PRD for full pattern reference.
2. **All `.md` files except `CLAUDE.md` live in `docs/`**.
3. **Component Organization**:
   - **NEVER** place components inside route/page folders (e.g., `app/(dashboard)/customers/components/` is FORBIDDEN)
   - Entity-specific components: `components/dashboard/<entity>/` (e.g., `components/dashboard/customers/`)
   - Reusable components: `components/dashboard/reusable/` (EmptyState, DeleteConfirmDialog, Pagination, TableSkeleton, StatsCards, ConfirmActionDialog)
   - Route files only in route folders: `page.tsx` and `*-page-client.tsx` — they import from `@/components/dashboard/`
   - UI primitives (shadcn): `apps/web/src/components/ui/`
4. **NEVER use `as any`, `as unknown`, `@ts-expect-error`, or `@ts-ignore`** — always fix TypeScript errors properly. Define proper types/interfaces. For untyped third-party data, assert to a specific type (`as MyType`), never `as any`. For third-party library type mismatches (e.g., React 18 vs 19 ref issues), use specific type casts like `as React.MutableRefObject<T>` or split conditional rendering paths instead of suppressing errors.
5. **Maximize shadcn/ui and reusable components** — always check `components/ui/` and `components/dashboard/reusable/` before building anything. Install missing shadcn components via `npx shadcn@latest add <component>` from `apps/web/`. Never hand-roll HTML when a shadcn equivalent exists. Never duplicate UI patterns.
6. **Keep the chatbot knowledge base up to date** — `apps/web/src/lib/chatbot/knowledge-base.ts` contains all FAQ entries. Update in the same commit when features change. Use industry-agnostic language.
7. **Never use `template.tsx` for route group layouts** — causes remount on every navigation, breaks browser history. Always use `layout.tsx`.
8. **Housekeeping on every change** — When adding, modifying, or removing anything (new routes, components, schema files, actions, API endpoints, migrations, etc.), update **all** of these in the same commit:
   - `docs/project_docs/REPO_MAP.md` — add/remove/rename file entries
   - `docs/claude/API_DOCUMENTATION.md` — add/update/remove endpoint docs (method, path, auth, request/response shapes)
   - `apps/web/src/lib/chatbot/knowledge-base.ts` — add/edit/remove FAQ entries for affected features
   - `docs/claude/todo.md` — mark completed items, add new tasks if needed
   - `docs/claude/lessons.md` — add any non-obvious insights, gotchas, or corrections from the work
9. **`docs/claude/todo.md` formatting rules** — Keep the todo file clean, concise, and current:
   - **Three sections only**: `## In Progress`, `## Backlog`, `## Completed`
   - **In Progress** — only genuinely open work with unchecked `[ ]` items. Move here when you start working on something. Never leave completed items lingering.
   - **Backlog** — planned/deferred work not yet started. Split into subsections if needed (e.g., "Deferred / Blocked", "Future Ideas").
   - **Completed** — one-line summaries with date. No verbose sub-task breakdowns — that detail lives in git history. Format: `- [x] **Feature Name** (YYYY-MM-DD) — brief description`
   - **Keep it short** — aim for <120 lines total. If the Completed section grows beyond ~50 items, archive older ones into a collapsed `<details>` block or remove them entirely.
   - **No duplicate sections** — never have two "In Progress" or two "Recently Completed" headings.
   - **Mark done immediately** — check off `[x]` items and move to Completed as soon as work is done, not in batches.
   - **Use absolute dates** — never "next Thursday" or "tomorrow". Always `YYYY-MM-DD`.
   - **No orphan checkboxes** — every `[ ]` must be under an active In Progress or Backlog item. If it's done, check it. If it's abandoned, remove it.
10. **`docs/claude/lessons.md` MUST be updated after every session** — This is the project's institutional memory. Rules:
    - **When to add**: After ANY user correction, hard-won debugging insight, library gotcha, workaround, or non-obvious pattern discovery. If you struggled with something for more than 5 minutes, it's a lesson.
    - **When to update**: If an existing lesson is outdated or wrong (e.g., library upgraded, workaround no longer needed), update or remove it.
    - **Format**: Group by topic (existing sections or new ones). Each bullet: bold the takeaway, then explain why. Keep it specific and actionable — "don't do X because Y" not "be careful with X".
    - **Not for code patterns** — Don't log things derivable from reading the code. Log the *surprise*: the thing that wasn't obvious, that cost time, that would bite someone again.
    - **Review at session start** — Always skim `docs/claude/lessons.md` before starting work to avoid repeating past mistakes.
    - **NEVER let it go stale** — If multiple sessions pass without a lessons update, something is wrong. Every significant piece of work teaches something.
11. **Check `docs/claude/deferred-fixes/` before building any feature** — This folder tracks known bugs and validation gaps discovered during end-to-end audits that were deferred because the related feature wasn't live yet. Before implementing a feature (payments, SMS, billing, etc.), check for matching deferred fixes and resolve them in the same PR. When auditing a flow, log any issues that can't be fixed immediately as deferred fixes with severity, file paths, line numbers, and suggested fix. Mark issues `FIXED` with date when resolved.
