"use client";
import { useEffect, useState } from "react";

export default function UnderDev() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background px-4">

      {/* Background grid using border color */}
      <div
        className="pointer-events-none absolute inset-0 animate-[gridDrift_20s_linear_infinite]"
        style={{
          backgroundImage:
            "linear-gradient(hsl(var(--border)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Ambient glows */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, hsl(var(--brand)) 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute left-1/3 top-1/3 h-[350px] w-[350px] -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full opacity-20"
        style={{ background: "radial-gradient(circle, hsl(var(--midnight)) 0%, transparent 70%)", animationDelay: "1s" }}
      />

      {/* Content */}
      <div
        className={`relative z-10 flex flex-col items-center gap-10 text-center transition-all duration-700 ${
          visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0"
        }`}
      >
        {/* Eyebrow */}
        <span
          className="rounded-full px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em]"
          style={{
            background: "hsl(var(--brand-light))",
            color: "hsl(var(--brand))",
            border: "1px solid hsl(var(--brand) / 0.25)",
          }}
        >
          In progress
        </span>

        {/* Orbital icon */}
        <div className="relative flex h-36 w-36 items-center justify-center">
          {/* Outer ring */}
          <div
            className="absolute inset-0 animate-spin rounded-full [animation-duration:8s]"
            style={{ border: "1px solid hsl(var(--brand) / 0.3)" }}
          >
            <div
              className="absolute left-1/2 top-0 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: "hsl(var(--brand))",
                boxShadow: "0 0 12px hsl(var(--brand)), 0 0 24px hsl(var(--brand) / 0.4)",
              }}
            />
          </div>

          {/* Inner ring */}
          <div
            className="absolute inset-4 animate-spin rounded-full [animation-direction:reverse] [animation-duration:5s]"
            style={{ border: "1px solid hsl(var(--midnight-light) / 0.6)" }}
          >
            <div
              className="absolute left-1/2 top-0 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full"
              style={{
                background: "hsl(var(--midnight-foreground))",
                boxShadow: "0 0 8px hsl(var(--midnight-foreground) / 0.6)",
              }}
            />
          </div>

          {/* Core */}
          <div
            className="absolute inset-7 flex animate-pulse items-center justify-center rounded-full backdrop-blur-sm"
            style={{
              background: "hsl(var(--surface))",
              border: "1px solid hsl(var(--brand) / 0.2)",
            }}
          >
            <svg
              className="h-7 w-7"
              style={{ color: "hsl(var(--brand))" }}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <div>
          <h1
            className="text-5xl font-extrabold tracking-tight"
            style={{ color: "hsl(var(--ink))" }}
          >
            Under{" "}
            <span style={{ color: "hsl(var(--brand))" }}>Development</span>
          </h1>
          <p
            className="mx-auto mt-4 max-w-xs text-sm leading-relaxed"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            Something remarkable is being assembled. Come back soon — it'll be
            worth the wait.
          </p>
        </div>

        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div
            className="mb-2.5 flex justify-between font-mono text-[11px]"
            style={{ color: "hsl(var(--muted-foreground))" }}
          >
            <span>Build progress</span>
            <span>67%</span>
          </div>
          <div
            className="h-[3px] w-full overflow-hidden rounded-full"
            style={{ background: "hsl(var(--border))" }}
          >
            <div
              className="h-full rounded-full transition-all duration-[2500ms] ease-out"
              style={{
                width: visible ? "67%" : "0%",
                background: "linear-gradient(to right, hsl(var(--brand)), hsl(var(--midnight-foreground)))",
              }}
            />
          </div>
        </div>

        {/* Steps */}
        <div className="flex w-full max-w-xs flex-col gap-3">
          {[
            { label: "Architecture & design system", state: "done" },
            { label: "Core features & integrations", state: "active" },
            { label: "Testing & launch", state: "pending" },
          ].map(({ label, state }, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 text-[13px] transition-all duration-500 ${
                visible ? "translate-x-0 opacity-100" : "-translate-x-2 opacity-0"
              }`}
              style={{ transitionDelay: `${0.8 + i * 0.2}s` }}
            >
              {/* Dot */}
              <div
                className={`flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-full ${
                  state === "active" ? "animate-pulse" : ""
                }`}
                style={{
                  background:
                    state === "done"
                      ? "hsl(var(--brand-light))"
                      : state === "active"
                      ? "hsl(var(--surface-alt))"
                      : "transparent",
                  border:
                    state === "done"
                      ? "1px solid hsl(var(--brand) / 0.3)"
                      : state === "active"
                      ? "1px solid hsl(var(--brand) / 0.5)"
                      : "1px solid hsl(var(--border))",
                }}
              >
                {state !== "pending" && (
                  <div
                    className="h-1.5 w-1.5 rounded-full"
                    style={{
                      background:
                        state === "done"
                          ? "hsl(var(--brand))"
                          : "hsl(var(--brand))",
                    }}
                  />
                )}
              </div>

              {/* Label */}
              <span
                style={{
                  color:
                    state === "done"
                      ? "hsl(var(--muted-foreground))"
                      : state === "active"
                      ? "hsl(var(--ink))"
                      : "hsl(var(--muted-foreground) / 0.5)",
                  textDecoration: state === "done" ? "line-through" : "none",
                  textDecorationColor: "hsl(var(--brand) / 0.4)",
                }}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
      </div>

      <style>{`
        @keyframes gridDrift {
          from { transform: translateY(0); }
          to { transform: translateY(60px); }
        }
      `}</style>
    </div>
  );
}