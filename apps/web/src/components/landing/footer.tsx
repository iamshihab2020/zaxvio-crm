import Link from "next/link";
import { Separator } from "@/components/ui/separator";
import { Logo } from "@/components/logo";

/**
 * Footer.
 *
 * Two columns instead of five. The old "Industries" column listed five labels
 * that all pointed at the same `#industries` anchor, so four of them were
 * decoration; the About, Contact, Privacy and Terms entries pointed at `href="#"`,
 * which scrolls the reader to the top of the page and looks broken. Dead links
 * in a footer cost trust on the one page whose whole job is earning it, so they
 * are gone until the pages behind them exist.
 */

const PRODUCT_LINKS = [
  { label: "Features", href: "/#features" },
  { label: "Industries", href: "/#industries" },
  { label: "Pricing", href: "/#pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "Start free trial", href: "/signup" },
  { label: "Log in", href: "/login" },
] as const;

function FooterColumn({
  heading,
  links,
}: {
  heading: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <nav aria-label={heading}>
      <h3 className="text-sm font-semibold text-midnight-foreground/70">
        {heading}
      </h3>
      {/* Footer links are the easiest thing on a page to under-size: the text
          is 18px tall, so the tap target is 18px unless the anchor is given
          height of its own. */}
      <ul role="list" className="mt-2">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="inline-flex min-h-[40px] items-center rounded-sm text-sm text-midnight-foreground/60 transition-colors hover:text-midnight-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function Footer() {
  return (
    <footer className="bg-midnight text-midnight-foreground" role="contentinfo">
      <Separator className="bg-midnight-foreground/10" />

      <div className="mx-auto w-full max-w-6xl px-5 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-2">
            <Logo size="md" />
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-midnight-foreground/60">
              Scheduling, quotes, invoices and customer history for field
              service businesses. One plan, one price.
            </p>
          </div>

          <FooterColumn heading="Product" links={PRODUCT_LINKS} />
          <FooterColumn heading="Account" links={ACCOUNT_LINKS} />
        </div>

        <Separator className="my-8 bg-midnight-foreground/10" />

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="tnum font-mono text-[11px] text-midnight-foreground/40">
            &copy; {new Date().getFullYear()} Zaxvio
          </p>
          <p className="text-[11px] text-midnight-foreground/40">
            Built for HVAC, plumbing, electrical, cleaning and landscaping.
          </p>
        </div>
      </div>
    </footer>
  );
}
