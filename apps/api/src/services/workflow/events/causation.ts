/**
 * How deep a chain of automations an event is.
 *
 * ## The hole this closes
 *
 * `execute()` has always had a depth guard, and until now it guarded nothing.
 * It reads `params.depth`, which is passed by one automation calling another
 * directly — the `workflow.run` node, which does not exist yet. An
 * **event-triggered** run starts fresh at depth 0, every time, because the event
 * is the only thing the matcher sees and an event carried no history.
 *
 * That was harmless while automations could not raise events: the executors
 * wrote their tables directly and stayed silent, which is a much worse bug
 * (P7a) but did have the accidental property of making cycles impossible. The
 * moment `job.moveStage` started going through `moveJobStage()` — and so
 * raising `job.stage_changed` like every other writer — an automation triggered
 * on a stage change that moves a stage became an infinite loop. Not a slow one:
 * a tight cycle through the outbox, writing rows until the tenant's quota or the
 * disk stops it.
 *
 * ## Why this is ambient rather than a parameter
 *
 * The obvious implementation is a `causationDepth` argument threaded from the
 * executor through the domain service, through `emitStageChangeEvents`, through
 * the producer, into `emitWorkflowEvent`. That is roughly thirty producers and
 * every domain service written from here on, and **it is only correct while
 * nobody forgets one**. A producer that omits it does not fail to compile — it
 * defaults to 0 and quietly reopens the loop.
 *
 * Every defect this feature has produced has been one side of a seam disagreeing
 * with the other while both type-check: the trigger matcher storing event names
 * and querying node ids, the Stop node declaring `outcome` and reading
 * `stopType`, `trigger_types` written by publish and read with the wrong
 * vocabulary. Adding a thirty-call-site seam to guard against runaway execution
 * is choosing the failure mode this codebase is demonstrably worst at.
 *
 * So the depth rides on the async context instead. The engine declares it once
 * around a node's execution and `emitWorkflowEvent` reads it, which means every
 * event raised by anything an executor calls — including services not yet
 * written — inherits it **by construction**. `AsyncLocalStorage` propagates
 * across `await`, which is the whole of what is needed here.
 *
 * Outside a run there is no store and the depth is 0, which is what a person
 * clicking a button in the UI should be.
 */

import { AsyncLocalStorage } from "node:async_hooks";

interface CausationStore {
  /** The depth to stamp on any event raised inside this scope. */
  depth: number;
}

const storage = new AsyncLocalStorage<CausationStore>();

/**
 * Run `fn` with every event it raises stamped at `depth`.
 *
 * Called by the engine with the current run's depth **plus one**: an event
 * raised by a run at depth 0 starts its own run at depth 1.
 */
export function runWithCausation<T>(depth: number, fn: () => Promise<T>): Promise<T> {
  return storage.run({ depth }, fn);
}

/** 0 outside a run — a person pressing a button starts a fresh chain. */
export function currentCausationDepth(): number {
  return storage.getStore()?.depth ?? 0;
}
