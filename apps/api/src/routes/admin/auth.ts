import type { FastifyInstance } from "fastify";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { getDb, adminUsers } from "@hvac-saas/database";
import { eq, and } from "drizzle-orm";

const loginBodySchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export default async function adminAuthRoutes(fastify: FastifyInstance) {
  fastify.post(
    "/login",
    {
      schema: {
        description: "Admin login — returns a JWT token",
        tags: ["Admin Auth"],
        body: {
          type: "object",
          required: ["email", "password"],
          properties: {
            email: { type: "string", format: "email" },
            password: { type: "string", minLength: 1 },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              token: { type: "string" },
              admin: {
                type: "object",
                properties: {
                  id: { type: "string" },
                  email: { type: "string" },
                  fullName: { type: "string" },
                  role: { type: "string" },
                },
              },
            },
          },
          400: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
          401: {
            type: "object",
            properties: {
              message: { type: "string" },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const parsed = loginBodySchema.safeParse(request.body);
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ message: "Invalid request body" });
      }

      const { email, password } = parsed.data;
      const db = getDb();

      const [admin] = await db
        .select()
        .from(adminUsers)
        .where(and(eq(adminUsers.email, email), eq(adminUsers.isActive, true)))
        .limit(1);

      if (!admin) {
        return reply
          .status(401)
          .send({ message: "Invalid email or password" });
      }

      const valid = await bcrypt.compare(password, admin.passwordHash);
      if (!valid) {
        return reply
          .status(401)
          .send({ message: "Invalid email or password" });
      }

      // Update lastLoginAt
      await db
        .update(adminUsers)
        .set({ lastLoginAt: new Date() })
        .where(eq(adminUsers.id, admin.id));

      const token = await reply.adminJwtSign({
        adminId: admin.id,
        email: admin.email,
        role: admin.role,
      });

      return reply.send({
        token,
        admin: {
          id: admin.id,
          email: admin.email,
          fullName: admin.fullName,
          role: admin.role,
        },
      });
    },
  );
}
