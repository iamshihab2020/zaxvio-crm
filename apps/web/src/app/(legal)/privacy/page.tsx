import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalContact,
  LegalDocument,
  LegalSection,
} from "@/components/landing/legal-document";
import { DATA_PROCESSORS } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — Zaxvio",
  description:
    "What Zaxvio collects, why, who it goes to, how long it is kept, and what you can ask us to do with it.",
};

const SECTIONS = [
  { id: "two-kinds", title: "Two kinds of data" },
  { id: "collect", title: "What we collect" },
  { id: "use", title: "How we use it" },
  { id: "processors", title: "Who it goes to" },
  { id: "support-access", title: "Support access" },
  { id: "customer-email", title: "Email to your customers" },
  { id: "retention", title: "How long we keep it" },
  { id: "cookies", title: "Cookies and storage" },
  { id: "rights", title: "Your choices" },
  { id: "changes", title: "Changes and contact" },
] as const;

/**
 * Drafted 2026-10-16 from what the code does (LAND-05). Every statement here
 * maps to something in the repo — see `lib/legal.ts` for where each fact was
 * read. Needs legal review before launch, and an address in
 * `LEGAL_CONTACT_EMAIL`.
 */
export default function PrivacyPage() {
  return (
    <LegalDocument
      title="Privacy Policy"
      lede="Zaxvio is software for running a service business. This page explains what we collect when you use it, why, who it goes to, and what you can ask us to do with it."
      sections={SECTIONS}
    >
      <LegalSection id="two-kinds" title="Two kinds of data">
        <p>
          <strong>Data about you</strong> is your account and your team: who you
          are, how you sign in, and your business details. We are responsible
          for it.
        </p>
        <p>
          <strong>Data about your customers</strong> is what you put into
          Zaxvio to run your business: their names, contact details, jobs,
          quotes and invoices. You decide what goes in and what it is used for.
          We store and process it on your behalf, only to provide the service.
        </p>
      </LegalSection>

      <LegalSection id="collect" title="What we collect">
        <ul>
          <li>
            <strong>Your account:</strong> your name, email address and
            password. The password is stored as a one-way hash and never in a
            form anyone can read back.
          </li>
          <li>
            <strong>Your business:</strong> its name, address, phone number,
            logo, timezone, and the prices, tax rates and settings you choose.
          </li>
          <li>
            <strong>Your team:</strong> the people you invite, their roles, and
            any labour cost rates you set for them.
          </li>
          <li>
            <strong>The records you create:</strong> customers and their contact
            details, notes and tags; jobs, checklists, photos and files; time
            logged on jobs; quotes, invoices and the payments you record;
            bookings; equipment and service agreements; messages with
            customers; and the automations you build and their run history.
          </li>
          <li>
            <strong>What your customers send you directly:</strong> the details
            they enter on your booking page or when answering a quote, and their
            choice if they unsubscribe from your emails.
          </li>
          <li>
            <strong>Technical data:</strong> IP addresses, used to limit how
            many requests can be made and in security logs; and page-load
            timings from Vercel Speed Insights, which uses no cookies.
          </li>
          <li>
            <strong>The help assistant:</strong> what you type into it, which is
            sent to Groq to produce a reply.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="use" title="How we use it">
        <ul>
          <li>To run the service you signed up for.</li>
          <li>
            To send the emails you ask Zaxvio to send, such as quotes, invoices,
            booking confirmations and the messages your automations send. They
            go out in your business&rsquo;s name.
          </li>
          <li>
            To tell you about your own account, for example that your trial is
            ending.
          </li>
          <li>To keep the service secure and to investigate problems.</li>
        </ul>
        <p>
          We do not sell personal data, and we do not use it for advertising.
          There are no advertising or tracking scripts on this site.
        </p>
      </LegalSection>

      <LegalSection id="processors" title="Who it goes to">
        <p>
          Zaxvio runs on the services below. Each receives data only to do its
          part of running Zaxvio, and some may process it outside your country.
        </p>
        <ul>
          {DATA_PROCESSORS.map((processor) => (
            <li key={processor.name}>
              <strong>
                {processor.name}, {processor.role.toLowerCase()}.
              </strong>{" "}
              {processor.what}
            </li>
          ))}
        </ul>
        <p>
          We will also disclose data where the law requires it.
        </p>
      </LegalSection>

      <LegalSection id="support-access" title="Support access">
        <p>
          Zaxvio support staff can open your workspace to investigate a problem
          or help you with one. Every time they do, we record who it was, when,
          and the reason they gave.
        </p>
        <p>
          For some kinds of access, the owner or an admin of your workspace is
          asked first and can say no. While that kind of session is active,
          your workspace shows that someone from support is viewing it.
        </p>
      </LegalSection>

      <LegalSection id="customer-email" title="Email to your customers">
        <p>
          Emails that are not about a specific job, quote or invoice, such as a
          review request or an automated follow-up, carry an unsubscribe link,
          and email apps that support one-click unsubscribe can use it. Once a
          customer unsubscribes, Zaxvio stops sending them those emails from
          your workspace.
        </p>
        <p>
          Emails they need in order to do business with you, like an invoice or
          a quote, are still sent.
        </p>
      </LegalSection>

      <LegalSection id="retention" title="How long we keep it">
        <p>
          Your account and the records in it are kept while your account is
          open. The detailed log of each automation run is kept for 90 days and
          then deleted automatically.
        </p>
      </LegalSection>

      <LegalSection id="cookies" title="Cookies and storage">
        <ul>
          <li>
            <strong>A sign-in cookie</strong> keeps you logged in. Without it
            the app cannot work.
          </li>
          <li>
            <strong>Your browser&rsquo;s local storage</strong> remembers
            display choices, such as light or dark mode and which dashboard
            widgets you show.
          </li>
        </ul>
        <p>There are no advertising or cross-site tracking cookies.</p>
      </LegalSection>

      <LegalSection id="rights" title="Your choices">
        <p>
          You can see, change and delete the records in your workspace yourself,
          inside the app. You can also ask us for a copy of the personal data we
          hold about you, or ask us to correct or delete it, or to close your
          account and delete its data.
        </p>
        <LegalContact topic="privacy requests" />
        <p>
          Zaxvio is for businesses and is not meant for anyone under 16.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and contact">
        <p>
          If we change this policy, we will update the date at the top. If the
          change matters to how your data is used, we will tell you by email
          before it takes effect.
        </p>
        <p>
          How you may use Zaxvio is covered by the{" "}
          <Link href="/terms">Terms of Service</Link>.
        </p>
      </LegalSection>
    </LegalDocument>
  );
}
