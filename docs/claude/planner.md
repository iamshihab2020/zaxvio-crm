# Planning Methodology

**ALWAYS use this methodology before writing any code for non-trivial tasks** (3+ steps, architectural decisions, new features, or complex refactoring).

## When to Plan

- New feature implementation
- Architectural changes
- Complex refactoring
- Bug fixes that span multiple files
- Any task with 3+ steps

## Plan Format

Write the plan to `docs/claude/todo.md` under `## In Progress` before writing any code.

### Required Sections

```markdown
## [Feature/Task Name]

### Overview
One paragraph describing what we're building and why.

### Requirements
- [ ] Requirement 1
- [ ] Requirement 2

### Architecture Changes
What files/modules are affected and how they connect.

### Implementation Steps (Phased)

#### Phase 1: [Name]
- [ ] Step with specific file path: `apps/api/src/routes/example.ts`
- [ ] Step with specific file path: `apps/web/src/components/dashboard/example/`

#### Phase 2: [Name]
- [ ] ...

### Testing Strategy
- Unit tests: what to test
- Integration tests: what flows to verify
- Manual verification: what to check

### Risks & Edge Cases
- Risk 1 and mitigation
- Edge case 1 and handling

### Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
```

## Planning Rules

1. **Read before planning** — Always read relevant existing code before writing a plan
2. **Be specific** — Include exact file paths, function names, and component names
3. **Phase the work** — Break into logical phases that can be verified independently
4. **Get approval** — Present the plan to the user before starting implementation
5. **Track progress** — Check off items in `docs/claude/todo.md` as you complete them
6. **Update on deviation** — If the plan changes during implementation, update `docs/claude/todo.md`
7. **No code without a plan** — If you catch yourself writing code for a non-trivial task without a plan, STOP and plan first
