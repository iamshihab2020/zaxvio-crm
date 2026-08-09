# WF-11 — Testing & Verification

> Related: [[workflow-automation/README|Workflow Automation]] | [[wf-00-decisions]] | [[wf-05-execution-engine]] | [[wf-12-phases]] | [[workflow]] | [[strict-rules]]

Every feature shipped in this repo so far was verifiable by looking at a page. A graph traversal with
OR-joins, durable pauses, compare-and-set transitions and a three-week resume window is not.

**`pnpm test` currently runs `vitest run`. Vitest appears in no `package.json` and there are zero
`*.test.ts` files repo-wide.** Phase 0 fixes that, because writing this engine without a harness is
the one decision that cannot be undone cheaply.

---

## 11.1 The harness

```
apps/api/
  vitest.config.ts              unit — no database, fast, runs on every save
  vitest.integration.config.ts  integration — real Neon, transaction-rolled-back
  src/test/
    setup.ts                    env loading, deterministic clock
    db.ts                       withRollback() — the whole integration story
    factories/                  tenant · customer · job · quote · invoice · workflow
    fixtures/events.ts          payloads generated FROM the Zod schemas

packages/workflow-nodes/
  vitest.config.ts              registry invariants — pure, no database
```

Both scripts already exist in `apps/api/package.json` (`test:unit`, `test:integration`); they have
simply never had a config or a dependency behind them.

### `withRollback` — the entire integration strategy

```ts
export async function withRollback<T>(fn: (db: Db) => Promise<T>): Promise<T> {
  const db = getDb();
  let out!: T;
  await db.transaction(async (tx) => {
    out = await fn(tx as unknown as Db);
    throw new RollbackSignal();          // always. nothing is ever committed.
  }).catch((e) => { if (!(e instanceof RollbackSignal)) throw e; });
  return out;
}
```

Runs against the real Neon database, writes real rows, and leaves nothing behind. This is why
`lib/tenant-guards.ts` types its `Db` as `Omit<ReturnType<typeof getDb>, "$client">` — the repo
already made its services transaction-compatible, and the test harness is the payoff.

Integration tests are **serial** (`--pool=forks --poolOptions.forks.singleFork`) because they share
one database.

### Deterministic time

Delay maths across timezone and DST boundaries is untestable against a moving clock. Every test that
touches time uses `vi.setSystemTime()`, and the engine reads time through one injectable `now()` so
a test can sit at `2026-11-02T06:30:00Z` — inside the US DST transition — and assert what a
"tomorrow at 9am" delay resolves to.

---

## 11.2 What gets tested, by layer

### Registry — pure, no database, runs in milliseconds

The invariants from [[wf-04-node-catalog|§4.3]], all mechanical:

| Test | Catches |
|---|---|
| Node ids are unique | a copy-paste |
| Node ids match `^[a-z][a-zA-Z]*(\.[a-z][a-zA-Z]*)+$` | [[10-audit-findings\|B-14]] — `create_calendar_event` frozen forever |
| **The committed id set only ever grows** | a rename, which breaks every saved automation |
| Property names unique within a node | |
| Every `default` is valid for its type/options | |
| Every `displayOptions` key names a real sibling | a filter that silently never applies |
| Every `filter.path` resolves against the variable registry | a filter reading a field the payload does not have |
| Every whitelisted node has a definition **and** an executor | the `coming-soon` gate being unsafe |
| The barrel imports every registry file | the Vercel OOM ([[11-frontend-guidelines\|FE-P2]]) |
| Every event type is claimed by ≥1 trigger, and every trigger's events exist | an orphan event |
| Every variable path is unique and its `resolve` is a function | |

The id-immutability test is worth its weight alone: it turns "we must never rename a node" from a
convention into a build failure.

### Events — the [[10-audit-findings|B-01]] defence

```ts
// fixtures are GENERATED from the schema, never hand-written
const payload = fixtureFor("job.stage_changed");        // derived from the Zod schema
```

| Test | Catches |
|---|---|
| Every producer's output parses against its schema, `.strict()` | an extra or misspelled key |
| Every producer is called with explicit fields — a lint rule forbids spread in `producers.ts` | a raw row leaking in |
| The worker re-parses on read | drift between write and read |
| **Round trip: the real producer emits → the real matcher consumes** | exactly the outage that killed every stage-filtered goal node in the source system |

That last row is the one that matters. The source system's unit test passed for months because it
hand-wrote a camelCase payload production never emitted. A test that calls the real producer cannot
lie in that direction.

### Filter matcher — a matrix

One table, ~22 operators × value shapes (`null`, `""`, `[]`, `0`, `false`, a real value):

| Test | Catches |
|---|---|
| Every operator against every value shape | an operator nobody exercised |
| **An unset filter matches everything** | the bug where every automation fires on everything, or nothing |
| `0` and `false` are *values*, not "unset" | "minimum total: 0" being silently ignored |
| `failedOn` / `expected` / `actual` are correct | a useless "why didn't it run?" diagnostic |
| A stage filter keys on `lifecycle`, not the label | a renamed column breaking the automation |

### Engine — unit

Pure graph functions with a hand-built graph and a stub executor:

- BFS order for linear, branch, converge, diamond, fan-out
- **OR-join**: a converging node fires when either branch arrives
- **AND-join**: `logic.merge` waits for all, and fires exactly once
- Branch routing follows `source_handle`, and an unrouted handle stops that path
- `goto` clears the queue, respects `maxLoops`, and re-runs its target
- Loop: iteration cap, `loop.item/index/total`, then `done`
- Disabled nodes are skipped, logged, and pass through on `main`
- Node budget and wall clock both terminate with partial output preserved
- Interpolation happens **once**, before dispatch, and `noInterpolate` is honoured

### Engine — integration, against real Neon

The cases that only exist when a database does:

| Test | Asserts |
|---|---|
| A delay pauses, and a resume continues **from the successor** | the core mechanic |
| **Resume across a simulated process restart** — write the row, drop the in-memory state, resume | that the pause is genuinely durable |
| Compare-and-set: a concurrent goal exit and a delay pause race | exactly one wins, the other is a no-op |
| Enrollment: a second event for a waiting subject **refreshes**, never duplicates | the 23505 branch, verified by execution |
| Idempotency: the same queue row processed twice creates one run | the unique index |
| Version pinning: publish v2 mid-pause; the run resumes on **v1** | [[wf-00-decisions\|D-06]] — the whole reason for versioning |
| Subject deleted mid-pause → `cancelled`, not `failed` | a deleted job is not a bug |
| Context over 256 KB truncates and flags | [[wf-00-decisions\|D-20]] |
| `at-most-once` re-entry after a crash refuses | [[wf-00-decisions\|D-22]] |
| A tenant at quota is refused, and told | not silently dropped |
| **Cross-tenant: an automation cannot read or write another tenant's rows** | the §10.1 rules, per action node |

The version-pinning test is the one to write first, because it is the assertion that this engine is
safe to edit while it runs.

### Outbox — integration

- Claim under simulated concurrency: two workers, twenty rows, **zero double-processing**
- Backoff schedule is 30s → 1m → 2m → 4m → 8m → dead letter
- Stale `processing` rows recover after 5 minutes
- A failing subscriber does **not** retry the other subscriber ([[10-audit-findings|B-07]])
- The event and its domain write commit or roll back **together**

### Executors — one test per node

Each asserts three things and only three:

1. It calls the domain service with the right arguments.
2. It returns the right handle for each outcome.
3. It **does not write a table directly** — enforced by passing a `db` proxy that throws on
   `update`/`insert`/`delete` for domain tables.

That third assertion is [[wf-00-decisions|D-17]] made mechanical. It is the cheapest possible
enforcement of the rule most likely to be broken by a hurried future change.

### Frontend

`apps/web` has vitest in its scripts too. Modest, targeted coverage:

- `build-node.ts` seeds every definition default into `parameters`
  ([[wf-06-triggers-and-events|§6.4]] — the UI default and the runtime default must be one
  declaration)
- `validate.ts` produces the right errors and warnings for each broken graph shape
- `relink-on-delete` reconnects neighbours
- `displayOptions` evaluation
- Variable pill parse/serialise round-trips

No canvas snapshot tests. They are brittle and they test React Flow, not us.

---

## 11.3 Manual verification, per phase

Automated tests do not cover "does it feel right" or "did the email actually arrive". Each phase in
[[wf-12-phases]] carries a short manual list. The standing ones:

- [ ] A three-week delay survives a real deploy (set `resume_at` to +2 minutes, redeploy, confirm)
- [ ] The builder's draft/published state is unmistakable at a glance
- [ ] A failed run's replay page explains the failure in words a contractor would use
- [ ] The 390px viewport has no horizontal scroll (this repo has regressed on that before)
- [ ] Light and dark are both correct on the canvas
- [ ] An automation email arrives, renders, and its unsubscribe link works
- [ ] Turning an automation off stops it immediately

---

## 11.4 Verification standard

This repo holds itself to *verified by execution*, not *looks right*: the invoices migration was
verified 79/79, the jobs remediation 45/45, the booking work 105/105. The same standard applies here.

**A phase is not done until:**

1. Its automated tests pass and the count is recorded in [[wf-PROGRESS]].
2. Its migration has been applied to Neon and **re-run at least three more times**, producing only
   NOTICEs, with column and index sets byte-identical after each ([[strict-rules|§1]]).
3. Every FK and every unique index has been proven by execution — insert a violation, observe
   `23503`/`23505`, roll back.
4. The manual list is walked.
5. `pnpm typecheck` and `pnpm lint` are clean.

> **Who runs what.** The user runs `pnpm typecheck`, `pnpm lint`, `pnpm build` and the browser
> checks. The plan's job is to produce commands and tests that are worth running, and to state
> plainly what has and has not been verified — never to claim a phase is green without the output.

---

## 11.5 Test data

`pnpm seed:demo` already produces a working dataset: 13 customers, 19 jobs across all three stages,
12 invoices, 7 quotes, 8 bookings, 15 catalog items, 10 assets, 4 checklist templates, contracts,
calendar events, notes and activity — all scoped to one tenant, `--reset`-able, and verified 18/18
against Neon.

Phase 0 extends it with `--with-automations`, installing the ten launch templates **inactive** plus
a handful of completed runs, so the replay UI, the runs list and the enrollment view all have
something real to render from the first day they exist.

---

## 11.6 What is deliberately not tested

| Not testing | Why |
|---|---|
| React Flow itself | it is a dependency |
| Canvas visual snapshots | brittle; the manual list covers what matters |
| Email rendering pixel-by-pixel | React Email templates are already reviewed by eye |
| Neon's transaction semantics | |
| Every permutation of 60 nodes × 32 events | the matrix tests cover the *mechanisms*; combinatorics adds cost, not confidence |
