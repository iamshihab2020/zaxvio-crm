"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { IconMenu2 } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";
import { cn } from "@/lib/utils";

const NAV_LINKS = [
  { label: "Features", href: "#features" },
  { label: "Industries", href: "#industries" },
  { label: "Pricing", href: "#pricing" },
  { label: "FAQ", href: "#faq" },
  { label: "Blog", href: "/blog" },
] as const;

const SECTION_IDS = ["features", "industries", "pricing", "faq"] as const;

/**
 * Landing navbar.
 *
 * Deliberately a full-width bar rather than the floating rounded pill it
 * replaces. The pill forced two problems that could not be fixed separately:
 * its contents sat over a permanently dark hero, so every label needed a
 * light-on-dark and a dark-on-light variant switched by scroll position — and
 * the light-on-dark variant leaked `hover:bg-white/10` into light mode, where
 * it is invisible. A full-bleed mobile menu could also never line up with a
 * floating rounded box, leaving a visible seam. A bar inherits the page's own
 * surface tokens, so neither problem exists.
 *
 * The mobile menu is a shadcn `Sheet` (Radix Dialog). That supplies the focus
 * trap, Escape handling, overlay dismissal and scroll lock that the previous
 * hand-rolled panel either lacked or got wrong — its `body { overflow: hidden }`
 * was a no-op, because globals.css makes <html> the scroll container, so the
 * page scrolled away behind the open menu.
 */
export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [active, setActive] = useState<string | null>(null);
  const pendingHash = useRef<string | null>(null);
  const sentinel = useRef<HTMLDivElement>(null);

  /* Whether the page has scrolled at all, from a sentinel at the top of the
     document rather than a scroll listener.

     The listener this replaces ran `setScrolled` on every scroll frame, so a
     continuous input drove React state and re-rendered the header on each one.
     The observer fires twice in a session: once when the sentinel leaves the
     viewport and once when it comes back. The same pattern is used directly
     below for section highlighting, so the file already depended on it. */
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  /* Highlight whichever section the reader is currently in. */
  useEffect(() => {
    const targets = SECTION_IDS.map((id) => document.getElementById(id)).filter(
      (el): el is HTMLElement => el !== null,
    );
    if (targets.length === 0) return;

    /* Track which sections are currently in the band, rather than reading only
       the entries that changed. An observer callback reports changes, so
       reacting to `entries` alone leaves the last match highlighted after the
       reader scrolls back to the hero — the nav claimed "FAQ" at scroll 0. */
    const visible = new Set<string>();

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target.id);
          else visible.delete(entry.target.id);
        }

        const first = SECTION_IDS.find((id) => visible.has(id));
        setActive(first ? `#${first}` : null);
      },
      { rootMargin: "-25% 0px -60% 0px" },
    );

    targets.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);

  /* An in-sheet anchor has to wait for the Sheet to close before scrolling —
     Radix still holds the scroll lock at click time, which would swallow it. */
  useEffect(() => {
    if (menuOpen || !pendingHash.current) return;
    const hash = pendingHash.current;
    pendingHash.current = null;
    const id = window.setTimeout(() => {
      document.querySelector(hash)?.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", hash);
    }, 220);
    return () => window.clearTimeout(id);
  }, [menuOpen]);

  const handleAnchorClick = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>, href: string, inSheet: boolean) => {
      if (!href.startsWith("#")) return;
      e.preventDefault();

      if (inSheet) {
        pendingHash.current = href;
        setMenuOpen(false);
        return;
      }

      // scroll-margin-top in globals.css keeps the heading clear of this bar.
      document.querySelector(href)?.scrollIntoView({ behavior: "smooth" });
      history.replaceState(null, "", href);
    },
    [],
  );

  return (
    <>
      {/* Sits at the very top of the document, behind the fixed header, and is
          watched by the observer above. 8px matches the old scrollY threshold
          exactly, so the bar turns opaque at the same point it always did. */}
      <div
        ref={sentinel}
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-2"
      />

      <header
        className={cn(
          "fixed inset-x-0 top-0 z-50 transition-colors duration-200",
          scrolled
            ? "border-b border-border bg-surface/90 backdrop-blur-md"
            : "border-b border-transparent",
        )}
      >
      <nav
        aria-label="Main"
        className="mx-auto flex h-16 w-full max-w-6xl items-center gap-4 px-5 sm:px-6 lg:px-8"
      >
        <Logo size="md" />

        <ul className="ml-4 hidden items-center gap-0.5 md:flex" role="list">
          {NAV_LINKS.map((link) => {
            const isActive = active === link.href;
            return (
              <li key={link.href}>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "h-9 px-3 text-sm",
                    isActive
                      ? "text-brand hover:text-brand"
                      : "text-muted-foreground hover:text-ink",
                  )}
                >
                  <a
                    href={link.href}
                    aria-current={isActive ? "true" : undefined}
                    onClick={(e) => handleAnchorClick(e, link.href, false)}
                  >
                    {link.label}
                  </a>
                </Button>
              </li>
            );
          })}
        </ul>

        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          {/* 40px floor on every control in the bar — shadcn's default `h-9`
              is 36px, which is under the comfortable tap target for a page
              read one-handed on a phone. */}
          <ThemeToggle className="h-10 w-10" />

          <Button
            asChild
            variant="ghost"
            className="hidden h-10 text-muted-foreground hover:text-ink sm:inline-flex"
          >
            <Link href="/login">Log in</Link>
          </Button>

          <Button asChild className="h-10 font-semibold">
            <Link href="/signup">Start free trial</Link>
          </Button>

          <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
            <SheetTrigger asChild>
              {/* 44×44 — the minimum comfortable tap target. The trigger this
                  replaces was a bare 24px icon. */}
              <Button
                variant="ghost"
                size="icon"
                className="-mr-2 h-11 w-11 md:hidden"
                aria-label="Open menu"
              >
                <IconMenu2 className="!size-[22px]" />
              </Button>
            </SheetTrigger>

            <SheetContent
              side="right"
              showCloseButton
              aria-describedby={undefined}
              className="flex w-[86%] flex-col gap-0 p-0 sm:max-w-sm"
            >
              <SheetTitle className="sr-only">Menu</SheetTitle>

              <div className="flex h-16 shrink-0 items-center px-5">
                <Logo size="md" />
              </div>
              <Separator />

              <nav aria-label="Mobile" className="flex-1 overflow-y-auto px-3 py-2">
                <ul role="list">
                  {NAV_LINKS.map((link) => (
                    <li key={link.href}>
                      <Button
                        asChild
                        variant="ghost"
                        className="h-auto min-h-[52px] w-full justify-start px-3 text-base font-medium text-ink"
                      >
                        <a
                          href={link.href}
                          onClick={(e) => handleAnchorClick(e, link.href, true)}
                        >
                          {link.label}
                        </a>
                      </Button>
                    </li>
                  ))}
                </ul>
              </nav>

              <Separator />
              <div className="grid shrink-0 gap-2 p-5">
                <Button asChild size="lg" className="h-12 text-base font-semibold">
                  <Link href="/signup" onClick={() => setMenuOpen(false)}>
                    Start free trial
                  </Link>
                </Button>
                <Button
                  asChild
                  variant="outline"
                  size="lg"
                  className="h-12 text-base"
                >
                  <Link href="/login" onClick={() => setMenuOpen(false)}>
                    Log in
                  </Link>
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
      </header>
    </>
  );
}
