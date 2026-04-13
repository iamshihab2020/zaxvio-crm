# Security Rules (MUST FOLLOW)

> Related: [[strict-rules]] | [[api-rules]] | [[tenant-security]] | [[auth-flow]]

1. **Tenant isolation in EVERY query**: Every `UPDATE`, `DELETE`, and `SELECT` on tenant-scoped tables MUST include `tenantId` in the WHERE clause. Never use only the record ID. Pattern: `and(eq(table.tenantId, tenantId), eq(table.id, id))`.
2. **Zod validation on ALL request inputs**: Every route handler MUST use Zod schemas for `params`, `body`, and `query` via `fastify-type-provider-zod`. Never use `as Record<string, unknown>`, `as any`, or manual type casts on request data.
3. **Never trust client-side cookies for authorization**: Role/permission checks must use server-side session verification (`getServerSession()` or `auth.api.getSession()`). Client-set cookies are for UI hints only.
4. **Rate limiting required**: All public endpoints and auth endpoints MUST have rate limits via `@fastify/rate-limit` route-level config.
5. **Sanitize LLM/AI prompt inputs**: Never interpolate raw user input into system prompts. Always sanitize (strip control chars, limit length) before inclusion.
6. **Email subject sanitization**: All email subject lines that interpolate user data MUST use `sanitizeSubject()` from `lib/email.ts` to strip `\r`, `\n`, `\t` and prevent header injection.
7. **Security headers required**: `next.config.mjs` must include `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Strict-Transport-Security`, `Referrer-Policy`, `Permissions-Policy`.
8. **Password policy**: Minimum 12 characters, must contain uppercase + lowercase + number. Use the shared `passwordSchema` from `lib/schemas/auth.ts`.
9. **Storage path validation**: User-provided storage paths must be validated to start with `tenantId/`. Never store arbitrary paths.
10. **Swagger disabled in production**: API docs (`/docs`) must be gated behind `NODE_ENV !== "production"`.
11. **No unsafe type assertions on user input**: Never use `as string`, `as number`, `as any` on `request.body`, `request.params`, or `request.query`. Always validate with Zod first.
