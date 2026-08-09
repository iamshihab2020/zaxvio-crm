/**
 * `email.send` — the node the whole opt-out gate was built for.
 *
 * Four rules, each of which is the fix to something that has already gone
 * wrong somewhere:
 *
 * 1. **The recipient is a role, never an address** (wf-00 D-14). `customer`,
 *    `assignee` or a named team member. A free-text address field on an
 *    automation is an open relay with a nice UI: anyone who can edit a workflow
 *    could mail anyone from the tenant's verified domain.
 * 2. **Customer sends go through `canEmailCustomer()`** and nothing else. One
 *    gate, not a check per call site — the defect this repo keeps repeating is
 *    a rule applied in one place and never swept.
 * 3. **A refused send is `skipped`, not failed.** An unsubscribed customer is
 *    the automation working correctly. Failing would stop the run and fire a
 *    failure notification, which trains people to ignore failure notifications.
 * 4. **`sideEffect: at-most-once`.** The engine writes a `running` log row
 *    before calling this, and a resume that finds one refuses rather than
 *    sending twice.
 */

import { user, eq } from "@hvac-saas/database";
import { canEmailCustomer, unsubscribeUrl } from "../../../../lib/email-consent.js";
import { sendNotificationAlertEmail } from "../../../../lib/email.js";
import { NodeFailure } from "../errors.js";
import type { Executor } from "./types.js";

type Recipient = "customer" | "assignee" | "member";

const emailSend: Executor = async ({ db, ctx, params, node }) => {
  const recipient = (params.recipient as Recipient | undefined) ?? "customer";
  const subject = asText(params.subject);
  const body = asText(params.body);

  if (!subject || !body) {
    throw new NodeFailure(
      "Email node is missing a subject or a body",
      `The "${node.label}" step has no subject or no message, so there was nothing to send. Open the step and fill both in.`,
    );
  }

  if (recipient === "customer") {
    if (!ctx.customer) {
      return {
        skipped:
          "This automation isn't running for a customer, so there was nobody to email.",
      };
    }

    // The gate. The purpose comes from the step, not from here — this used to
    // hardcode `marketing` on the reasoning that "everything an automation sends
    // is", which is true of a review request and false of an overdue invoice.
    // `email-consent.ts` is explicit that the exemption is an argument you pass;
    // deciding it once for every automation in the product is what that rule
    // exists to prevent.
    //
    // Anything other than the exact string falls back to `marketing`, so an old
    // saved node with no `purpose` — every one that exists today — keeps the
    // behaviour it had rather than silently gaining an exemption.
    const consent = await canEmailCustomer(db, {
      tenantId: ctx.tenantId,
      customerId: ctx.customer.id,
      purpose: params.purpose === "transactional" ? "transactional" : "marketing",
    });

    if (!consent.allowed || !consent.email) {
      // The reason is already written for a human — that is why the gate
      // returns a decision rather than a boolean.
      return { skipped: consent.reason };
    }

    const outcome = await sendNotificationAlertEmail({
      to: consent.email,
      subject,
      props: {
        audience: "customer",
        recipientName: ctx.customer.firstName,
        businessName: ctx.tenant.businessName,
        businessLogoUrl: ctx.tenant.logoUrl,
        businessPhone: ctx.tenant.phone,
        businessAddress: ctx.tenant.address,
        title: subject,
        body,
        ctaLabel: asText(params.ctaLabel) || null,
        ctaUrl: asText(params.ctaUrl) || null,
        // Attribution, in the footer. A customer who receives an automated
        // message and cannot tell it was automated has been misled about who
        // they are talking to.
        sentByAutomation: ctx.workflowName,
        unsubscribeUrl: unsubscribeUrl(ctx.tenantId, ctx.customer.id),
      },
    });

    return outcomeToResult(outcome, consent.email, node.label);
  }

  // ── team recipients ───────────────────────────────────────────────────────
  //
  // No consent gate: a team member is not a subscriber and has no consent to
  // withdraw. Their control is Settings → Notifications, which is a different
  // mechanism for a different relationship.
  const target =
    recipient === "assignee"
      ? { id: ctx.assignee?.id, name: ctx.assignee?.name, email: ctx.assignee?.email }
      : await loadMemberTarget(db, ctx.tenantId, asText(params.memberId));

  // An unassigned job is a normal state, so that one is a skip. A named member
  // who has left is *not* — but it never reaches here: the engine's ownership
  // re-check runs before this executor and fails the node with "open the step
  // and pick a different one", which is the outcome a tenant can act on. What
  // is left for this branch is a member who exists and has no address.
  if (!target?.email) {
    return {
      skipped:
        recipient === "assignee"
          ? "Nobody is assigned to this job, so there was no one to email."
          : "That team member has no email address on file.",
    };
  }

  const outcome = await sendNotificationAlertEmail({
    to: target.email,
    subject,
    props: {
      audience: "team",
      recipientName: target.name ?? "there",
      businessName: ctx.tenant.businessName,
      businessLogoUrl: ctx.tenant.logoUrl,
      businessPhone: ctx.tenant.phone,
      businessAddress: ctx.tenant.address,
      title: subject,
      body,
      ctaLabel: asText(params.ctaLabel) || null,
      ctaUrl: asText(params.ctaUrl) || null,
      sentByAutomation: ctx.workflowName,
      // Deliberately absent for `team`: E-15 gates the link on audience, and a
      // teammate unsubscribing from their own workspace's alerts is not what
      // that control means.
      unsubscribeUrl: null,
    },
  });

  return outcomeToResult(outcome, target.email, node.label);
};

/**
 * Turn a three-state `EmailOutcome` into a node result.
 *
 * `skipped` is a **configuration** state — no API key, no verified sender —
 * and it is the normal state in development. Recording it as a failure would
 * fill a tenant's run history with red for something that is not their problem
 * and not a delivery failure; recording it as a send would be the lie DF-NOT-04
 * fixed. It is neither, and it says so.
 */
function outcomeToResult(
  outcome: { status: "sent" | "skipped" | "failed"; reason?: string },
  to: string,
  nodeLabel: string,
) {
  if (outcome.status === "sent") {
    return { output: { to, delivered: true } };
  }
  if (outcome.status === "skipped") {
    return {
      skipped: `Email isn't set up on this workspace yet, so "${nodeLabel}" didn't send.`,
      output: { to, delivered: false },
    };
  }
  throw new NodeFailure(
    `Email send failed: ${outcome.reason ?? "unknown"}`,
    `We couldn't deliver the email from "${nodeLabel}" to ${to}. ${outcome.reason ?? ""}`.trim(),
  );
}

/**
 * A named team member.
 *
 * **Ownership is re-checked here, at execution time**, not just when the graph
 * was saved. The row can be deleted, and an automation can be duplicated into
 * another workspace; there is no row-level security underneath (D-16). The
 * caller passes the tenant, and `loadOrgMember` refuses an id that is not a
 * member of it.
 */
async function loadMemberTarget(
  db: Parameters<Executor>[0]["db"],
  tenantId: string,
  memberId: string,
): Promise<{ id: string; name: string; email: string | null } | null> {
  if (!memberId) return null;

  const { assertOrgMember } = await import("../ownership.js");
  const owned = await assertOrgMember(db, tenantId, memberId);
  if (!owned) return null;

  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(user)
    .where(eq(user.id, memberId));
  return row ?? null;
}

/** Interpolation already ran; this is only narrowing an unknown. */
function asText(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export default emailSend;
