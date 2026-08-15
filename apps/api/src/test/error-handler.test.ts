import { describe, expect, it } from "vitest";
import Fastify from "fastify";

import { buildErrorResponse, registerErrorHandler } from "../lib/error-handler.js";

/**
 * What an error looks like by the time it leaves the API.
 *
 * This file exists because a customer was shown a LATERAL join. Fastify's
 * default handler serialises `error.message`, and for a `DrizzleQueryError`
 * that message is the SQL plus its bound parameters — so the Costs tab rendered
 * three table names and a tenant uuid to someone who wanted to know what a job
 * cost.
 *
 * The two rules pull in opposite directions, which is why both are tested:
 * a 5xx must say nothing, and a 4xx must say everything. Losing either one is
 * a regression nobody would notice until it mattered.
 */

/** A bare instance with the real handler on it. No port, no database. */
function appWith(route: (app: ReturnType<typeof Fastify>) => void) {
  const app = Fastify({ logger: false });
  registerErrorHandler(app);
  route(app);
  return app;
}

/** Exactly the shape Drizzle throws: statement in the message, reason on cause. */
function drizzleError(): Error {
  const err = new Error(
    'Failed query: select "workflows"."id" from "workflows" where tenant_id = $1' +
      "\nparams: 556682d0-fa7b-4f40-a843-3765181dbe68",
  );
  (err as Error & { cause?: unknown }).cause = {
    code: "22P02",
    message: 'malformed array literal: "job.created"',
  };
  return err;
}

describe("a 500 tells the client nothing about the database", () => {
  it("replaces the message, and keeps a reference the user can quote", async () => {
    const app = appWith((a) => a.get("/boom", async () => { throw drizzleError(); }));
    const res = await app.inject({ method: "GET", url: "/boom" });
    const body = res.json() as { message: string };
    const raw = JSON.stringify(body);

    expect(res.statusCode).toBe(500);
    expect(raw).not.toContain("select");
    expect(raw).not.toContain("workflows");
    expect(raw).not.toContain("556682d0");
    expect(raw).not.toContain("    at ");
    expect(body.message).toMatch(/^Something went wrong on our end\. Reference [0-9a-f]{8}\.$/);
    await app.close();
  });

  it("logs the CAUSE, not just the statement", () => {
    // The half that explains anything lives on `.cause`. Logging only the
    // message is the mistake `workflow_event_queue.last_error` already made:
    // the parked row recorded WHAT query failed and never WHY.
    //
    // `buildErrorResponse` is called directly — it is the function that decides
    // what gets logged, and intercepting pino to reach it would be testing the
    // logger rather than the decision.
    const captured: Record<string, unknown>[] = [];
    buildErrorResponse(
      drizzleError(),
      (payload) => captured.push(payload),
      { url: "/jobs/x/costs", method: "GET" },
    );

    expect(captured).toHaveLength(1);
    expect(captured[0].causeCode).toBe("22P02");
    expect(captured[0].causeMessage).toContain("malformed array literal");
    expect(captured[0].reference).toMatch(/^[0-9a-f]{8}$/);
    // And the context that makes a log line searchable.
    expect(captured[0].url).toBe("/jobs/x/costs");
  });
});

describe("a 4xx still says what happened", () => {
  it("passes a deliberate message through untouched", async () => {
    const app = appWith((a) =>
      a.get("/refused", async () => {
        const err = new Error("This quote has already been accepted.") as Error & { statusCode?: number };
        err.statusCode = 409;
        throw err;
      }),
    );
    const res = await app.inject({ method: "GET", url: "/refused" });
    expect(res.statusCode).toBe(409);
    expect((res.json() as { message: string }).message).toBe("This quote has already been accepted.");
    await app.close();
  });

  it("keeps validation detail, which is the only thing naming the bad field", async () => {
    const app = appWith((a) =>
      a.get("/invalid", async () => {
        const err = new Error("querystring/limit must be a number") as Error & {
          statusCode?: number; validation?: unknown;
        };
        err.statusCode = 400;
        err.validation = [{ instancePath: "/limit", message: "must be a number" }];
        throw err;
      }),
    );
    const res = await app.inject({ method: "GET", url: "/invalid" });
    const body = res.json() as { message: string; validation?: unknown };
    expect(res.statusCode).toBe(400);
    expect(body.message).toContain("limit");
    expect(body.validation).toBeTruthy();
    await app.close();
  });
});

describe("the contract the web depends on", () => {
  it("puts the text in `message` on every branch", async () => {
    // `lib/api-fetch.ts` reads `body.message`. If that key moved, every error
    // in the product would silently become "Something went wrong".
    const app = appWith((a) => {
      a.get("/five", async () => { throw drizzleError(); });
      a.get("/four", async () => {
        const err = new Error("Nope") as Error & { statusCode?: number };
        err.statusCode = 403;
        throw err;
      });
    });
    for (const url of ["/five", "/four"]) {
      const body = (await app.inject({ method: "GET", url })).json() as { message?: unknown };
      expect(typeof body.message).toBe("string");
    }
    await app.close();
  });
});
