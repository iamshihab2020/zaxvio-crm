import { Resend } from "resend";
import { env } from "./env.js";

let resend: Resend | null = null;

function getResend(): Resend | null {
  if (!env.RESEND_API_KEY) return null;
  if (!resend) {
    resend = new Resend(env.RESEND_API_KEY);
  }
  return resend;
}

interface InvitationEmailData {
  to: string;
  inviterName: string;
  organizationName: string;
  role: string;
  inviteUrl: string;
}

export async function sendInvitationEmail(data: InvitationEmailData) {
  const client = getResend();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not configured — skipping invitation email to", data.to);
    console.info("[email] Invite URL:", data.inviteUrl);
    return;
  }

  const roleLabel = data.role.charAt(0).toUpperCase() + data.role.slice(1);

  await client.emails.send({
    from: env.RESEND_FROM_EMAIL,
    to: data.to,
    subject: `You've been invited to join ${data.organizationName}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <h2 style="color: #1a1a1a; font-size: 24px; margin-bottom: 8px;">You're invited!</h2>
        <p style="color: #555; font-size: 16px; line-height: 1.6; margin-bottom: 24px;">
          <strong>${data.inviterName}</strong> has invited you to join <strong>${data.organizationName}</strong> as a <strong>${roleLabel}</strong>.
        </p>
        <a href="${data.inviteUrl}" style="display: inline-block; background-color: #f97316; color: #fff; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
          Accept Invitation
        </a>
        <p style="color: #999; font-size: 13px; margin-top: 32px;">
          This invitation expires in 7 days. If you didn't expect this email, you can safely ignore it.
        </p>
      </div>
    `,
  });
}
