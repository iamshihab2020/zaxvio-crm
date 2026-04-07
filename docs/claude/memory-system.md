# Memory System

Three-tier persistent memory that complements `docs/claude/todo.md`, `docs/claude/lessons.md`, and auto-memory `MEMORY.md`:

| Memory File | Purpose | Lifecycle | Source |
|---|---|---|---|
| `scripts/memory/recent-memory.md` | Rolling 48hr session summaries | Overwritten each run | JSONL conversation logs |
| `scripts/memory/long-term-memory.md` | Stable facts, preferences, gotchas | Append-only | `docs/claude/lessons.md` + session corrections |
| `scripts/memory/project-memory.md` | Active project snapshot | Overwritten each run | `docs/claude/todo.md` + git state |

**At session start**: Read `recent-memory.md` + `project-memory.md` for context. Reference `long-term-memory.md` for architecture/library decisions.

**Authoritative sources remain**: `docs/claude/todo.md` (tasks) and `docs/claude/lessons.md` (lessons). Memory files are optimized read-only views.

**Consolidation**: Run `node scripts/memory/consolidate-memory.mjs` manually or via nightly scheduled task (`scripts/memory/install-memory-task.bat`). For in-session updates, use the `consolidate-memory` skill.

**Auto-memory** (`.claude/projects/.../memory/MEMORY.md`): Loaded at start of every conversation. Update the "Current State" section after completing major work, after user corrections, and after major architecture decisions.
