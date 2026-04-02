"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="aurora-bg relative overflow-hidden py-24 sm:py-32"
    >
      <Fade inView inViewOnce>
        <div className="relative z-10 mx-auto max-w-2xl px-6 text-center">
          {/* Glass card */}
          <div className="rounded-3xl border border-white/10 bg-white/5 p-10 backdrop-blur-xl sm:p-14">
            <h2
              id="final-cta-heading"
              className="font-heading text-3xl font-bold tracking-tight text-midnight-foreground sm:text-4xl"
            >
              Ready to run your service business smarter?
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-lg text-midnight-foreground/60">
              Join hundreds of service professionals who&apos;ve ditched the
              clipboard for good.
            </p>
            <div className="mt-8">
              <Button
                asChild
                size="lg"
                className="h-12 rounded-xl bg-brand px-10 font-heading text-sm font-semibold text-brand-foreground shadow-lg shadow-brand/25 hover:bg-brand/90 hover:shadow-xl hover:shadow-brand/30 transition-all"
              >
                <Link href="/signup">Start Your Free Trial</Link>
              </Button>
              <p className="mt-4 text-sm text-midnight-foreground/40">
                No credit card required &middot; Set up in 10 minutes
              </p>
            </div>
          </div>
        </div>
      </Fade>
    </section>
  );
}
