import { Navbar } from "@/components/landing/navbar";
import { Footer } from "@/components/landing/footer";
import { SkipLink } from "@/components/landing/skip-link";
import { MotionProvider } from "@/components/motion-provider";
import { RouteStage } from "@/components/route-stage";

export default function BlogLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <MotionProvider>
      <SkipLink />
      <Navbar />
      {/* RouteStage: the blog list and a post arrive like any other route. */}
      <RouteStage id="main" className="min-h-screen pt-[72px]">
        {children}
      </RouteStage>
      <Footer />
    </MotionProvider>
  );
}
