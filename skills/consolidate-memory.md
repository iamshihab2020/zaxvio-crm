# Skill: Consolidate Memory

Use this methodology to manually consolidate session context into the persistent memory layer. Run this at the end of a productive session or when asked to `/consolidate-memory`.

## Prerequisites

Ensure these files exist:
- `scripts/memory/recent-memory.md` — rolling session summaries
- `scripts/memory/long-term-memory.md` — stable facts and preferences
- `scripts/memory/project-memory.md` — active project snapshot
- `docs/todo.md` — task tracking (authoritative)
- `docs/lessons.md` — lessons learned (authoritative)

## Steps

### 1. Read All Memory Files

Read the current state of all five files above. Note what's already captured to avoid duplication.

### 2. Summarize Current Session

Compile from the current conversation:
- **User requests**: What did the user ask for?
- **Key decisions**: What approaches were chosen and why?
- **Files changed**: Which files were created, edited, or deleted?
- **User corrections**: Did the user correct any mistakes or redirect the approach?
- **Blockers/issues**: Were there any unexpected problems?

### 3. Update Recent Memory

Add a new session block to `scripts/memory/recent-memory.md`:

```markdown
## Session: YYYY-MM-DD HH:MM
- **Branch**: `<current-branch>`
- **Requests**: <brief list>
- **Decisions**: <key choices made>
- **Files changed**: <list of paths>
- **Corrections**: <any user feedback>
```

Keep only the last 48 hours of sessions. Remove older blocks.

### 4. Promote Durable Facts to Long-Term Memory

Review the session for stable, reusable insights:
- New user preferences (tools, patterns, naming conventions)
- Architecture decisions that won't change
- Gotchas discovered during implementation
- Library/API quirks

Append these to the appropriate section in `scripts/memory/long-term-memory.md`. Do NOT duplicate entries already present.

### 5. Refresh Project Memory

Update `scripts/memory/project-memory.md` from current state:
- Run `git rev-parse --abbrev-ref HEAD` for current branch
- Run `git log -1 --format="%h %s"` for last commit
- Read `docs/todo.md` for current/next tasks
- Update the build order progress checklist

### 6. Sync Back to Authoritative Files

If new gotchas or lessons were identified:
- Append to `docs/lessons.md` under the appropriate section
- Update `docs/todo.md` if task status changed

### 7. Verify

- Confirm no duplicate entries across memory files
- Confirm `docs/lessons.md` and `docs/todo.md` are still the authoritative sources
- Memory files are optimized views, not replacements

## Important Notes

- `docs/todo.md` and `docs/lessons.md` are **authoritative** — memory files are derived views
- Memory files in `scripts/memory/` are gitignored (local only)
- The nightly script (`scripts/memory/consolidate-memory.mjs`) handles automated consolidation
- This skill is for **manual, in-session** consolidation with richer context
