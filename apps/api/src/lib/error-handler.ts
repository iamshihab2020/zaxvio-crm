/**
 * What an error looks like by the time it leaves the API.
 *
 * Fastify's default handler serialises `error.message` straight to the client.
 * For a `DrizzleQueryError` that message **is the SQL plus its bound
 * parameters** — which is how the Costs tab came to render a LATERAL join,
 * three table names and a tenant uuid to a customer who only wanted to know
 * what a job cost. Database internals in front of an end user, and useless to
 * them: nothing in that text tells them what to do next.
 *
 * Two rules:
 *
 *   - **4xx passes through.** Those messages are written for the person reading
 *     them — which field is invalid, "this quote has already been accepted",
 *     why the upload was refused. Replacing them would make the product mute
 *     about the things it deliberately explains.
 *   - **5xx is replaced**, and the real error is logged with its `cause`.
 *     `DrizzleQueryError.message` is the statement; the *reason* — the Postgres
 *     code and text — hangs off `.cause`, and logging only the message throws
 *     away the half that explains anything. That mistake is already recorded
 *     twice in this codebase: `workflow_event_queue.last_error` stores the
 *     statement and not the cause, and it cost a day of a dead-lettered row
 *     saying *what* failed and never *why*.
 *
 * The reference id is the point of the exchange: the user can quote eight
 * characters and they appear verbatim in the logs, so nobody has to reproduce
 * anything.
 *
 * Lives here rather than inline in `server.ts` because `server.ts` calls
 * `start()` at module scope — importing it to test the handler binds port 4000.
 * A module that cannot be imported without side effects cannot be tested.
 */

import { randomUUID } from "node:crypto";
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

/** The shape every error response has, whichever branch produced it. */
export interface ErrorBody {
  statusCode: number;
  error: string;
  message: string;
  validation?: unknown;
}

/**
 * What actually arrives here — which is not `FastifyError`.
 *
 * Fastify *types* the error handler's argument as `FastifyError`, but at runtime
 * anything thrown inside a handler lands there, and the error this module exists
 * for is a `DrizzleQueryError`: an ordinary `Error` with a `cause`, no
 * `statusCode` and no `code`. Declaring the narrow type meant the test that
 * proves the SQL-leak branch had to pass its realistic error `as never` — a cast
 * papering over a signature that was describing the happy path rather than the
 * input.
 */
type HandledError = Error & {
  statusCode?: number;
  code?: string;
  validation?: FastifyError["validation"];
};

export function buildErrorResponse(
  error: HandledError,
  log: (payload: Record<string, unknown>, message: string) => void,
  context: { url: string; method: string; tenantId?: string },
): ErrorBody {
  const status = error.statusCode ?? 500;

  if (status < 500) {
    return {
      statusCode: status,
      error: error.name || "Error",
      message: error.message,
      ...(error.validation ? { validation: error.validation } : {}),
    };
  }

  const reference = randomUUID().slice(0, 8);
  const cause = error.cause as
    | { code?: string; message?: string; detail?: string }
    | undefined;

  log(
    {
      reference,
      err: error,
      // Spelled out rather than left to the serialiser: `err` renders the
      // message and the stack, and for a query error neither says what
      // Postgres actually objected to.
      causeCode: cause?.code,
      causeMessage: cause?.message,
      causeDetail: cause?.detail,
      ...context,
    },
    "Unhandled error",
  );

  return {
    statusCode: 500,
    error: "Internal Server Error",
    message: `Something went wrong on our end. Reference ${reference}.`,
  };
}

export function registerErrorHandler(fastify: FastifyInstance): void {
  fastify.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    const body = buildErrorResponse(
      error,
      (payload, message) => request.log.error(payload, message),
      {
        url: request.url,
        method: request.method,
        // `?? undefined`, because the decorator types it `string | null` and
        // the context field is optional. Null and absent mean the same thing
        // here — no tenant in scope — so collapsing them loses nothing.
        tenantId: request.authUser?.tenantId ?? undefined,
      },
    );
    return reply.status(body.statusCode).send(body);
  });
}
