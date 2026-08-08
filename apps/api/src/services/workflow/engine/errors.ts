/**
 * Control flow that has to cross the whole call stack.
 *
 * **Pauses are exceptions, not return values** (wf-05 §5.8 invariant 2). A
 * `delay.wait` five nodes deep inside a loop body has to suspend the entire run,
 * and the alternative — every function in the chain returning a discriminated
 * union that every caller checks — means one forgotten check silently continues
 * past a pause. As a throw, control flow still reads top to bottom and a missing
 * handler is loud rather than invisible.
 */

/** Base class, so the engine can tell "our signal" from "something broke". */
export class WorkflowSignal extends Error {
  constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

/**
 * A wait node paused the run. The engine serialises the context, sets
 * `resume_at`, and returns `waiting` — **this is not a failure**.
 */
export class DelayPause extends WorkflowSignal {
  constructor(
    readonly resumeAt: Date,
    readonly nodeId: string,
    /**
     * Make the paused node run *again* on resume rather than continuing to its
     * successor. Needed the moment a gate exists — an approval node has to
     * re-evaluate the thing it was waiting on.
     */
    readonly reExecuteCurrentNode = false,
  ) {
    super(`Run paused until ${resumeAt.toISOString()}`);
  }
}

/** A `goal.event` node registered a listener. `resume_at` stays NULL — only a
 *  matching event can end this wait. P6; the class lands now so the terminal
 *  handling in `execute()` does not change shape later. */
export class GoalWait extends WorkflowSignal {
  constructor(readonly nodeId: string, readonly goalEvent: string) {
    super(`Waiting for ${goalEvent}`);
  }
}

/** `logic.stop`. The author chose how the run ends, so the engine obeys. */
export class WorkflowStopped extends WorkflowSignal {
  constructor(
    readonly stopType: "completed" | "failed" | "cancelled",
    readonly reason: string,
  ) {
    super(reason);
  }
}

/**
 * The subject row no longer exists.
 *
 * Terminates as **`cancelled`, not `failed`** — a deleted job is not a bug, and
 * a failure notification for one trains people to ignore failure notifications.
 */
export class SubjectGone extends WorkflowSignal {
  constructor(readonly subjectType: string, readonly subjectId: string) {
    super(`The ${subjectType} this automation was running for no longer exists`);
  }
}

/** The 5-minute wall clock. A design constraint, not a tuning knob: long work
 *  is a *delay*, which persists and resumes. */
export class WorkflowTimeout extends WorkflowSignal {
  constructor(readonly elapsedMs: number) {
    super(
      `This automation ran for longer than 5 minutes and was stopped. If it needs to wait, use a Wait step instead — waits can last days without holding anything open.`,
    );
  }
}

/** A limit in `EXECUTION_LIMITS` was hit. Carries the plain-language reason. */
export class WorkflowLimitExceeded extends WorkflowSignal {}

/** A tenant quota refused the run before it started. Never silent (B-09). */
export class QuotaExceeded extends WorkflowSignal {
  constructor(
    readonly quota: "concurrent" | "daily" | "dailyEmails",
    message: string,
  ) {
    super(message);
  }
}

/**
 * A node's own failure, already translated for the person who has to fix it.
 *
 * `hint` is what the replay page and the failure notification show. Workflow
 * failures are the number one support driver a feature like this generates, and
 * `WORKFLOW_NODE_FAILED` next to a stack trace generates every one of them.
 */
export class NodeFailure extends WorkflowSignal {
  constructor(
    message: string,
    readonly hint: string,
    readonly cause?: unknown,
  ) {
    super(message);
  }
}

/** Wrap a promise in a wall clock. Rejects with `WorkflowTimeout`. */
export async function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timer: NodeJS.Timeout | undefined;
  const startedAt = Date.now();

  try {
    return await Promise.race([
      promise,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new WorkflowTimeout(Date.now() - startedAt)),
          ms,
        );
        // The timer must not keep the process alive. A run that finishes in
        // 200ms should not hold a five-minute handle open, and in a test that
        // difference is the whole runtime.
        timer.unref?.();
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
