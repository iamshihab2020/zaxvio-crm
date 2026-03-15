import Link from "next/link";
import { IconArrowLeft } from "@tabler/icons-react";
import { ThemeToggle } from "@/components/theme-toggle";
import { Logo } from "@/components/logo";

export function AuthShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen md:grid-cols-2">
      {/* Left: Brand panel */}
      <div className="relative hidden overflow-hidden bg-midnight md:flex md:flex-col md:justify-between">
        {/* Radial brand glow */}
        <div
          className="pointer-events-none absolute -bottom-32 -left-32 h-[500px] w-[500px] rounded-full opacity-20"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)",
          }}
        />
        <div
          className="pointer-events-none absolute -right-24 -top-24 h-[400px] w-[400px] rounded-full opacity-10"
          style={{
            background:
              "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)",
          }}
        />

        {/* Logo + tagline */}
        <div className="relative z-10 p-10">
          <Logo size="lg" />
        </div>

        {/* Center content */}
        <div className="relative z-10 px-10">
          <h2 className="font-heading text-3xl font-bold leading-tight text-midnight-foreground">
            Run your HVAC business
            <br />
            <span className="text-brand">without the paperwork.</span>
          </h2>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-midnight-foreground/60">
            Scheduling, invoicing, and customer management — all in one place.
            Built for solo contractors who&apos;d rather fix AC units than fight
            spreadsheets.
          </p>
        </div>

        {/* Testimonial */}
        <div className="relative z-10 p-10">
          <blockquote className="border-l-2 border-brand/40 pl-4">
            <p className="text-sm italic text-midnight-foreground/70">
              &ldquo;Went from sticky notes to a real system in 10 minutes.
              My invoicing alone saves me 5 hours a week.&rdquo;
            </p>
            <footer className="mt-2 text-xs text-midnight-foreground/50">
              — Mike R., Solo HVAC Tech, Houston TX
            </footer>
          </blockquote>
        </div>
      </div>

      {/* Right: Form panel */}
      <div className="relative flex flex-col bg-background">
        {/* Top bar: theme toggle */}
        <div className="flex items-center justify-end p-4">
          <ThemeToggle />
        </div>

        {/* Centered form */}
        <div className="flex flex-1 items-center justify-center px-6 pb-8">
          <div className="w-full max-w-sm">{children}</div>
        </div>

        {/* Back to home */}
        <div className="flex items-center justify-center pb-6">
          <Link
            href="/"
            className="flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
          >
            <IconArrowLeft size={14} />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
