import Link from "next/link";
import { Logo } from "@/components/logo";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const COMPANY_LINKS = [
  { label: "About", href: "#" },
  { label: "Contact", href: "#" },
  { label: "Blog", href: "#" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
] as const;

export function Footer() {
  return (
    <footer className="bg-midnight text-midnight-foreground" role="contentinfo">
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" />
            <p className="mt-3 text-sm text-midnight-foreground/60">
              Digital field service management built for solo HVAC contractors.
            </p>
          </div>

          {/* Product */}
          <nav aria-label="Product links">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-midnight-foreground/40">
              Product
            </h3>
            <ul className="mt-4 space-y-3" role="list">
              {PRODUCT_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-midnight-foreground/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Company */}
          <nav aria-label="Company links">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-midnight-foreground/40">
              Company
            </h3>
            <ul className="mt-4 space-y-3" role="list">
              {COMPANY_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-midnight-foreground/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Legal */}
          <nav aria-label="Legal links">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-midnight-foreground/40">
              Legal
            </h3>
            <ul className="mt-4 space-y-3" role="list">
              {LEGAL_LINKS.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-sm text-midnight-foreground/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 border-t border-midnight-foreground/10 pt-8">
          <p className="text-center text-sm text-midnight-foreground/40">
            &copy; {new Date().getFullYear()} Zaxvio. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
