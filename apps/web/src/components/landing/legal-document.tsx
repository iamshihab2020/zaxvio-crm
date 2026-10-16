import { formatDateOnly } from "@/lib/format";
import { LEGAL_CONTACT_EMAIL, LEGAL_LAST_UPDATED } from "@/lib/legal";

/**
 * The shared frame for /privacy and /terms (LAND-05).
 *
 * A reading surface, not a marketing one: a 68ch measure, the page's ruled
 * header so it still belongs to the site, and an "On this page" list that
 * sticks beside the text on wide screens. Long legal pages are scanned for one
 * answer far more often than read top to bottom, and the list is how the
 * reader finds it.
 */

export interface LegalSectionLink {
  id: string;
  title: string;
}

export function LegalDocument({
  title,
  lede,
  sections,
  children,
}: {
  title: string;
  lede: React.ReactNode;
  sections: readonly LegalSectionLink[];
  children: React.ReactNode;
}) {
  return (
    <article className="mx-auto w-full max-w-6xl px-5 pb-20 pt-10 sm:px-6 sm:pt-14 lg:px-8">
      <header className="max-w-3xl">
        <span aria-hidden="true" className="block h-px w-full bg-border" />
        <h1 className="mt-5 font-heading text-[1.75rem] font-bold leading-[1.15] tracking-tight text-ink text-balance sm:text-4xl">
          {title}
        </h1>
        <p className="mt-3 text-sm text-muted-foreground">
          Last updated{" "}
          <time dateTime={LEGAL_LAST_UPDATED} className="tnum">
            {formatDateOnly(LEGAL_LAST_UPDATED, { month: "long" })}
          </time>
        </p>
        <p className="mt-5 max-w-[68ch] text-base leading-relaxed text-ink/80 text-pretty sm:text-lg">
          {lede}
        </p>
      </header>

      <div className="mt-10 grid gap-10 lg:mt-14 lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-16">
        <nav aria-label="On this page" className="lg:sticky lg:top-24 lg:self-start">
          <p className="text-sm font-semibold text-ink">On this page</p>
          <ol role="list" className="mt-2">
            {sections.map((section) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  className="inline-flex min-h-[36px] items-center rounded-sm text-sm text-muted-foreground transition-colors hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {section.title}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="max-w-[68ch] space-y-10">{children}</div>
      </div>
    </article>
  );
}

export function LegalSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`}>
      <h2
        id={`${id}-heading`}
        className="font-heading text-xl font-semibold tracking-tight text-ink"
      >
        {title}
      </h2>
      <div className="mt-3 space-y-3 text-base leading-relaxed text-ink/80 text-pretty [&_a]:font-medium [&_a]:text-brand-ink [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:list-disc [&_ul]:space-y-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

/**
 * Where to write. Says plainly that no address is published yet rather than
 * inventing one; set `LEGAL_CONTACT_EMAIL` in `lib/legal.ts` and every page
 * using this picks it up.
 */
export function LegalContact({ topic }: { topic: string }) {
  if (LEGAL_CONTACT_EMAIL) {
    return (
      <p>
        For {topic}, email{" "}
        <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>.
      </p>
    );
  }
  return (
    <p>
      We have not published a contact address for {topic} yet. It will be
      listed here, on this page, once it exists.
    </p>
  );
}
