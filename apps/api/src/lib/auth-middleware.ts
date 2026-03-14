import type { FastifyRequest, FastifyReply } from "fastify";
import { auth } from "./auth.js";
import { fromNodeHeaders } from "better-auth/node";

export interface AuthUser {
  userId: string;
  email: string;
  name: string;
  role: string | null;
  activeOrganizationId: string | null;
}

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser;
  }
}

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(request.headers),
  });

  if (!session) {
    return reply.status(401).send({ message: "Unauthorized" });
  }

  request.authUser = {
    userId: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role ?? null,
    activeOrganizationId: session.session.activeOrganizationId ?? null,
  };
}

export async function requireAdmin(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (request.authUser.role !== "admin") {
    return reply.status(403).send({ message: "Forbidden: admin role required" });
  }
}

export async function requireTenant(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  await requireAuth(request, reply);
  if (reply.sent) return;

  if (!request.authUser.activeOrganizationId) {
    return reply
      .status(403)
      .send({ message: "Forbidden: no active organization" });
  }
}
