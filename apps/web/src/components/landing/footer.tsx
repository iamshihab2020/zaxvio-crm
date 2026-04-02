import Link from "next/link";
import { Logo } from "@/components/logo";

const PRODUCT_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

const INDUSTRY_LINKS = [
  { label: "HVAC", href: "#industries" },
  { label: "Plumbing", href: "#industries" },
  { label: "Electrical", href: "#industries" },
  { label: "Cleaning", href: "#industries" },
  { label: "Landscaping", href: "#industries" },
] as const;

const RESOURCES_LINKS = [
  { label: "Blog", href: "/blog" },
  { label: "About", href: "#" },
  { label: "Contact", href: "#" },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy Policy", href: "#" },
  { label: "Terms of Service", href: "#" },
] as const;

export function Footer() {
  return (
    <footer className="bg-midnight text-midnight-foreground" role="contentinfo">
      {/* Gradient separator */}
      <div className="h-px bg-gradient-to-r from-transparent via-brand/30 to-transparent" aria-hidden="true" />
      <div className="mx-auto max-w-7xl px-6 py-16">
        <div className="grid grid-cols-2 gap-8 md:grid-cols-5">
          {/* Brand column */}
          <div className="col-span-2 md:col-span-1">
            <Logo size="md" />
            <p className="mt-3 text-sm text-midnight-foreground/60">
              All-in-one service management for field service businesses.
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

          {/* Industries */}
          <nav aria-label="Industry links">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-midnight-foreground/40">
              Industries
            </h3>
            <ul className="mt-4 space-y-3" role="list">
              {INDUSTRY_LINKS.map((link) => (
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

          {/* Resources */}
          <nav aria-label="Resources links">
            <h3 className="font-heading text-sm font-semibold uppercase tracking-wider text-midnight-foreground/40">
              Resources
            </h3>
            <ul className="mt-4 space-y-3" role="list">
              {RESOURCES_LINKS.map((link) => (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className="text-sm text-midnight-foreground/60 transition-colors hover:text-white"
                  >
                    {link.label}
                  </Link>
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
