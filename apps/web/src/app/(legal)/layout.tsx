import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { SkipLink } from "@/components/landing/skip-link";
import { MotionProvider } from "@/components/motion-provider";
import { RouteStage } from "@/components/route-stage";

/**
 * /privacy and /terms. The same frame as the blog: the public navbar and
 * footer, so a visitor who follows a footer link is still on the site.
 *
 * Both paths are in `middleware.ts` `publicPaths`. They have to be: a privacy
 * policy that redirects a logged-out reader to /login is not published.
 */
export default function LegalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <SkipLink />
      <Navbar />
      <RouteStage id="main" className="min-h-screen bg-surface pt-16">
        {children}
      </RouteStage>
      <Footer />
    </MotionProvider>
  );
}
