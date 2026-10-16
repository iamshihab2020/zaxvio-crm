/**
 * "Skip to content", the first focusable element on every public page that
 * carries the fixed landing navbar (LAND-08).
 *
 * Without it a keyboard user tabs through the logo, five nav links, the theme
 * toggle, Log in and Start free trial before reaching anything on the page, on
 * every visit. Hidden until focused, then shown above the navbar (`z-50`).
 *
 * Every page that renders it must give its `<main>` the id `main`.
 */
export function SkipLink() {
  return (
    <a
      href="#main"
      className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-3 focus:z-[60] focus:rounded-md focus:bg-card focus:px-4 focus:py-2.5 focus:text-sm focus:font-semibold focus:text-ink focus:shadow-lg focus:outline-none focus:ring-2 focus:ring-ring"
    >
      Skip to content
    </a>
  );
}
