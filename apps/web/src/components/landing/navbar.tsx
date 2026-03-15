"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { IconMenu2, IconX } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
] as const;

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = useCallback(() => setMobileOpen(false), []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Body scroll lock + Escape key handler
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === "Escape") closeMobile();
      };
      window.addEventListener("keydown", onKeyDown);
      return () => {
        document.body.style.overflow = "";
        window.removeEventListener("keydown", onKeyDown);
      };
    } else {
      document.body.style.overflow = "";
    }
  }, [mobileOpen, closeMobile]);

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (!href.startsWith("#")) return;
    e.preventDefault();
    const el = document.querySelector(href);
    if (el) el.scrollIntoView({ behavior: "smooth" });
    closeMobile();
  };

  return (
    <>
      <header
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled || mobileOpen
            ? "bg-background/90 shadow-sm backdrop-blur-md"
            : "bg-transparent"
        }`}
      >
        <nav
          aria-label="Main navigation"
          className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4"
        >
          {/* Logo */}
          <Logo size="md" />

          {/* Desktop nav */}
          <ul className="hidden items-center gap-8 md:flex" role="list">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleAnchorClick(e, link.href)}
                  className={`text-sm font-medium transition-colors hover:text-brand ${
                    scrolled ? "text-foreground" : "text-white/80"
                  }`}
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          {/* Desktop CTAs */}
          <div className="hidden items-center gap-2 md:flex">
            <ThemeToggle
              className={scrolled ? "text-foreground" : "text-white/80"}
            />
            <Link
              href="/login"
              className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                scrolled
                  ? "text-foreground hover:bg-accent"
                  : "text-white/80 hover:text-white"
              }`}
            >
              Log in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-brand px-4 py-2 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
            >
              Get Started
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button
            type="button"
            onClick={() => setMobileOpen(!mobileOpen)}
            className={`md:hidden ${scrolled || mobileOpen ? "text-foreground" : "text-white"}`}
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <IconX size={24} /> : <IconMenu2 size={24} />}
          </button>
        </nav>
      </header>

      {/* Mobile menu — rendered outside header to avoid stacking context issues */}
      <div
        className={`fixed inset-0 z-40 flex flex-col bg-background pt-[64px] transition-all duration-300 ease-in-out md:hidden ${
          mobileOpen
            ? "opacity-100 translate-y-0"
            : "opacity-0 -translate-y-4 pointer-events-none"
        }`}
        aria-hidden={!mobileOpen}
      >
        {/* Nav links */}
        <ul className="flex flex-col px-6 pt-6" role="list">
          {NAV_LINKS.map((link) => (
            <li key={link.href} className="border-b border-border/20">
              <a
                href={link.href}
                onClick={(e) => handleAnchorClick(e, link.href)}
                className="block py-4 text-lg font-medium text-foreground transition-colors hover:text-brand active:text-brand"
                tabIndex={mobileOpen ? 0 : -1}
              >
                {link.label}
              </a>
            </li>
          ))}
        </ul>

        {/* CTAs */}
        <div className="mt-8 flex flex-col gap-3 px-6">
          <Link
            href="/signup"
            onClick={closeMobile}
            className="rounded-lg bg-brand px-4 py-3 text-center text-base font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
            tabIndex={mobileOpen ? 0 : -1}
          >
            Get Started
          </Link>
          <Link
            href="/login"
            onClick={closeMobile}
            className="rounded-lg border border-border px-4 py-3 text-center text-base font-medium text-foreground transition-colors hover:bg-accent"
            tabIndex={mobileOpen ? 0 : -1}
          >
            Log in
          </Link>
        </div>

        {/* Theme toggle at bottom */}
        <div className="mt-auto border-t border-border/20 px-6 py-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-muted-foreground">Theme</span>
            <ThemeToggle />
          </div>
        </div>
      </div>
    </>
  );
}
