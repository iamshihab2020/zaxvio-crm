import Link from "next/link";

export function FinalCtaSection() {
  return (
    <section
      aria-labelledby="final-cta-heading"
      className="relative overflow-hidden bg-brand py-24"
    >
      {/* Diagonal clip at top */}
      <div
        className="absolute inset-x-0 -top-px h-16 bg-surface"
        style={{ clipPath: "polygon(0 0, 100% 0, 100% 0%, 0 100%)" }}
        aria-hidden="true"
      />

      <div className="relative z-10 mx-auto max-w-3xl px-6 text-center">
        <h2
          id="final-cta-heading"
          className="font-heading text-3xl font-bold tracking-tight text-brand-foreground sm:text-4xl"
        >
          Ready to stop losing jobs to voicemail?
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-lg text-brand-foreground/80">
          Join contractors across Texas and Florida who&apos;ve ditched the
          clipboard for good.
        </p>
        <div className="mt-8">
          <Link
            href="/signup"
            className="inline-block rounded-lg bg-background px-8 py-3.5 font-heading text-sm font-semibold text-brand transition-colors hover:bg-background/90"
          >
            Start Your Free Trial
          </Link>
          <p className="mt-3 text-sm text-brand-foreground/60">
            No credit card required &middot; Set up in 10 minutes
          </p>
        </div>
      </div>
    </section>
  );
}
