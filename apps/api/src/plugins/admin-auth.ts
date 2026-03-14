import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import fastifyJwt from "@fastify/jwt";
import fp from "fastify-plugin";
import type { AdminRole } from "@hvac-saas/types";
import { env } from "../lib/env.js";

export interface AdminJwtPayload {
  adminId: string;
  email: string;
  role: AdminRole;
}

declare module "fastify" {
  interface FastifyInstance {
    verifyAdmin: (
      request: FastifyRequest,
      reply: FastifyReply,
    ) => Promise<void>;
    adminJwtSign: (payload: AdminJwtPayload) => Promise<string>;
  }
  interface FastifyRequest {
    admin: AdminJwtPayload;
    adminJwtVerify: <T = AdminJwtPayload>() => Promise<T>;
  }
  interface FastifyReply {
    adminJwtSign: (payload: AdminJwtPayload) => Promise<string>;
  }
}

async function adminAuthPlugin(fastify: FastifyInstance) {
  await fastify.register(fastifyJwt, {
    secret: env.ADMIN_JWT_SECRET,
    namespace: "admin",
    sign: { expiresIn: "4h" },
  });

  fastify.decorateRequest("admin", undefined as unknown as AdminJwtPayload);

  fastify.decorate(
    "verifyAdmin",
    async function (request: FastifyRequest, reply: FastifyReply) {
      try {
        const payload = await request.adminJwtVerify<AdminJwtPayload>();
        request.admin = payload;
      } catch {
        return reply
          .status(401)
          .send({ message: "Unauthorized: invalid or expired admin token" });
      }
    },
  );
}

export default fp(adminAuthPlugin, {
  name: "admin-auth",
});
