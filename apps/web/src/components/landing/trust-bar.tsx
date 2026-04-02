"use client";

import { useEffect, useRef, useState } from "react";
import {
  IconAirConditioning,
  IconDroplet,
  IconBolt,
  IconSpray,
  IconPlant2,
  IconTool,
} from "@tabler/icons-react";
import { Fade } from "@/components/animate-ui/primitives/effects/fade";

/* ---------- Animated counter hook ---------- */
function useCountUp(target: number, duration = 2000) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const hasAnimated = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasAnimated.current) {
          hasAnimated.current = true;
          const start = performance.now();
          const animate = (now: number) => {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
            setValue(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          requestAnimationFrame(animate);
        }
      },
      { threshold: 0.3 },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [target, duration]);

  return { ref, value };
}

const STATS = [
  { target: 500, suffix: "+", label: "Service Businesses" },
  { target: 4.9, suffix: "★", label: "Average Rating", isDecimal: true },
  { target: 6, suffix: "+", label: "Industries Served" },
  { target: 99, suffix: "%", label: "Uptime" },
] as const;

const INDUSTRIES = [
  { icon: IconAirConditioning, label: "HVAC" },
  { icon: IconDroplet, label: "Plumbing" },
  { icon: IconBolt, label: "Electrical" },
  { icon: IconSpray, label: "Cleaning" },
  { icon: IconPlant2, label: "Landscaping" },
  { icon: IconTool, label: "Handyman" },
] as const;

function StatCard({
  target,
  suffix,
  label,
  isDecimal,
  delay,
}: {
  target: number;
  suffix: string;
  label: string;
  isDecimal?: boolean;
  delay: number;
}) {
  const intTarget = isDecimal ? Math.floor(target * 10) : target;
  const { ref, value } = useCountUp(intTarget);
  const display = isDecimal ? (value / 10).toFixed(1) : value;

  return (
    <Fade inView inViewOnce delay={delay}>
      <div
        ref={ref}
        className="rounded-2xl border border-border/50 bg-card/50 p-6 text-center backdrop-blur-sm"
      >
        <p className="font-heading text-3xl font-bold text-ink sm:text-4xl">
          {display}
          <span className="text-brand">{suffix}</span>
        </p>
        <p className="mt-1 text-sm text-ink/50">{label}</p>
      </div>
    </Fade>
  );
}

export function TrustBar() {
  return (
    <section aria-labelledby="trust-heading" className="bg-surface py-16 sm:py-20">
      <div className="mx-auto max-w-5xl px-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {STATS.map((stat, i) => (
            <StatCard
              key={stat.label}
              target={stat.target}
              suffix={stat.suffix}
              label={stat.label}
              isDecimal={"isDecimal" in stat && stat.isDecimal}
              delay={i * 100}
            />
          ))}
        </div>

        {/* Industry icons */}
        <Fade inView inViewOnce delay={400}>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-8 sm:gap-12">
            <p
              id="trust-heading"
              className="text-xs font-semibold uppercase tracking-wider text-ink/30"
            >
              Built for
            </p>
            {INDUSTRIES.map((industry) => (
              <div
                key={industry.label}
                className="flex items-center gap-2 text-ink/40"
              >
                <industry.icon size={18} stroke={1.5} />
                <span className="text-sm font-medium">{industry.label}</span>
              </div>
            ))}
          </div>
        </Fade>
      </div>
    </section>
  );
}
