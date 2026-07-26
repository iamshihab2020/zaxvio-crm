import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import type { ZodTypeProvider } from "fastify-type-provider-zod";
import { requireAuth, requireTenant } from "../../lib/auth-middleware.js";
import { subscribe, type TenantEvent } from "../../lib/event-bus.js";
import { eventStreamQuery } from "../../lib/schemas/events.js";

/** Proxies and load balancers commonly idle out a stream after ~60s. */
const HEARTBEAT_MS = 25_000;

const eventRoutes: FastifyPluginAsyncZod = async (fastify) => {
  const f = fastify.withTypeProvider<ZodTypeProvider>();

  /**
   * GET /events — Server-Sent Events stream, scoped to the caller's tenant.
   *
   * Replaces Supabase Realtime. See docs/claude/reference/decisions.md (ADR-001).
   *
   * No response schema: this hijacks the socket and streams raw
   * `text/event-stream` frames rather than serialising a JSON body.
   */
  f.get(
    "/",
    { preHandler: [requireAuth], schema: { querystring: eventStreamQuery } },
    async (request, reply) => {
    // Supabase channels had no authorization — any authenticated user could
    // listen to another tenant by guessing its id. Scope it properly here:
    // your own tenant by default, another only if you are an admin.
    let tenantId: string;

    if (request.query.tenantId) {
      if (request.authUser.role !== "admin") {
        return reply.status(403).send({ message: "Forbidden: admin role required" });
      }
      tenantId = request.query.tenantId;
    } else {
      await requireTenant(request, reply);
      if (reply.sent) return;
      tenantId = request.authUser.tenantId!;
    }

    // Take over the socket so Fastify does not try to serialise a reply.
    reply.hijack();

    reply.raw.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Disable proxy buffering, which would otherwise hold frames back.
      "X-Accel-Buffering": "no",
    });

    const send = (data: string) => {
      // A dead socket after client disconnect would throw on write.
      if (!reply.raw.writableEnded) reply.raw.write(data);
    };

    send(`retry: 3000\n\n`);
    send(`event: connected\ndata: {}\n\n`);

    const unsubscribe = subscribe(tenantId, (tenantEvent: TenantEvent) => {
      // `event:` carries the channel so one stream serves all four, letting the
      // browser attach a listener per channel just like the old Supabase code.
      send(
        `event: ${tenantEvent.channel}\ndata: ${JSON.stringify({
          event: tenantEvent.event,
          payload: tenantEvent.payload,
        })}\n\n`,
      );
    });

    const heartbeat = setInterval(() => send(`: ping\n\n`), HEARTBEAT_MS);

    const cleanup = () => {
      clearInterval(heartbeat);
      unsubscribe();
      if (!reply.raw.writableEnded) reply.raw.end();
    };

    request.raw.on("close", cleanup);
    request.raw.on("error", cleanup);
    },
  );
};

export default eventRoutes;
