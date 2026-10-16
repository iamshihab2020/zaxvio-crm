import type { Metadata } from "next";
import Link from "next/link";
import {
  LegalContact,
  LegalDocument,
  LegalSection,
} from "@/components/landing/legal-document";

export const metadata: Metadata = {
  title: "Terms of Service — Zaxvio",
  description:
    "The terms for using Zaxvio: your account, the trial and price, your data, emailing your customers, and acceptable use.",
};

const SECTIONS = [
  { id: "agreement", title: "Agreeing to these terms" },
  { id: "service", title: "The service" },
  { id: "account", title: "Your account and team" },
  { id: "price", title: "Trial and price" },
  { id: "data", title: "Your data" },
  { id: "customers", title: "Your customers" },
  { id: "acceptable-use", title: "Acceptable use" },
  { id: "assistant", title: "The help assistant" },
  { id: "availability", title: "Availability" },
  { id: "ending", title: "Ending your use" },
  { id: "liability", title: "Liability" },
  { id: "changes", title: "Changes and contact" },
] as const;

/**
 * Drafted 2026-10-16 from what the product does (LAND-05). Plain language on
 * purpose: the reader is an owner-operator, not a lawyer. Needs legal review
 * before launch, including the liability section and a governing law, which
 * is deliberately absent because nothing in the repo says where the business
 * is established.
 */
export default function TermsPage() {
  return (
    <LegalDocument
      title="Terms of Service"
      lede="These are the terms for using Zaxvio. They are written in plain language, to be read in a few minutes rather than skimmed past."
      sections={SECTIONS}
    >
      <LegalSection id="agreement" title="Agreeing to these terms">
        <p>
          By creating an account or using Zaxvio, you agree to these terms on
          behalf of yourself and the business you sign up for. If you do not
          agree, do not use the service.
        </p>
      </LegalSection>

      <LegalSection id="service" title="The service">
        <p>
          Zaxvio is web software for running a service business: bookings, jobs,
          quotes, invoices, customer records, reports and automations. We keep
          improving it, which means features can be added, changed or removed
          over time.
        </p>
      </LegalSection>

      <LegalSection id="account" title="Your account and team">
        <ul>
          <li>Give accurate details when you sign up, and keep them current.</li>
          <li>
            Keep your password private. You are responsible for what happens
            under your account.
          </li>
          <li>
            You can invite people to your workspace. You are responsible for
            who you invite and what they do there, and you can remove them at
            any time.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="price" title="Trial and price">
        <p>
          New accounts get a 14-day free trial, and no card is needed to start
          it. After the trial, Zaxvio costs $49 a month for the whole business,
          however many people you invite, with no annual contract.
        </p>
        <p>
          We will not charge you anything unless you have given us your payment
          details and agreed to pay. You can stop using Zaxvio at any time.
        </p>
      </LegalSection>

      <LegalSection id="data" title="Your data">
        <p>
          The records you put into Zaxvio are yours. You give us permission to
          store, copy, process and send them only so far as we need to in order
          to run the service for you, as the{" "}
          <Link href="/privacy">Privacy Policy</Link> describes. We do not sell
          them and do not use them for advertising.
        </p>
      </LegalSection>

      <LegalSection id="customers" title="Your customers">
        <ul>
          <li>
            You are responsible for having the right to keep your customers&rsquo;
            details in Zaxvio and to contact them.
          </li>
          <li>
            Emails Zaxvio sends to your customers go out in your business&rsquo;s
            name, including the ones your automations send. You are responsible
            for what they say and for following the email and privacy laws that
            apply to you.
          </li>
          <li>
            When a customer unsubscribes, Zaxvio stops sending them non-essential
            email from your workspace. Do not work around that.
          </li>
        </ul>
      </LegalSection>

      <LegalSection id="acceptable-use" title="Acceptable use">
        <p>Do not use Zaxvio to:</p>
        <ul>
          <li>break the law, or store or send anything unlawful;</li>
          <li>send spam or unsolicited bulk email;</li>
          <li>
            try to reach another business&rsquo;s workspace, or any part of our
            systems you have not been given access to;
          </li>
          <li>
            point automations, webhooks or outbound requests at systems you are
            not allowed to use;
          </li>
          <li>
            upload malware, overload the service on purpose, or resell it
            without our agreement.
          </li>
        </ul>
        <p>
          We may suspend an account that does any of these, and will tell you
          why unless the law prevents it.
        </p>
      </LegalSection>

      <LegalSection id="assistant" title="The help assistant">
        <p>
          The in-app help assistant uses AI and can be wrong. Check what it tells
          you before you rely on it. When it offers to create something, such
          as a customer or a job, nothing is saved until you confirm.
        </p>
      </LegalSection>

      <LegalSection id="availability" title="Availability">
        <p>
          We work to keep Zaxvio running and your data safe, but we cannot
          promise it will always be available or free of errors. It may be
          unavailable at times for maintenance or because of problems with the
          services it runs on.
        </p>
      </LegalSection>

      <LegalSection id="ending" title="Ending your use">
        <p>
          You can stop using Zaxvio at any time. We may end or suspend access
          for a serious or repeated breach of these terms. If you want your
          account and its data deleted, ask us, as the{" "}
          <Link href="/privacy#rights">Privacy Policy</Link> explains.
        </p>
      </LegalSection>

      <LegalSection id="liability" title="Liability">
        <p>
          Zaxvio is provided as it is. As far as the law allows, we are not
          liable for indirect losses, such as lost profits or lost business,
          and our total liability to you is limited to what you paid us in the
          12 months before the claim. Nothing here limits liability that the
          law does not allow to be limited.
        </p>
      </LegalSection>

      <LegalSection id="changes" title="Changes and contact">
        <p>
          If we change these terms, we will update the date at the top, and we
          will tell you by email before a change that affects you takes effect.
        </p>
        <LegalContact topic="questions about these terms" />
      </LegalSection>
    </LegalDocument>
  );
}
