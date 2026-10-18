import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      // Inter everywhere (2026-10-18). The three slot names survive so no
      // component had to change: `font-heading` and `font-body` are the same
      // face, and `font-mono` (times, counts, money) is Inter too. Figures
      // still line up because those places also set `tnum`; Inter's tabular
      // figures do the job DM Mono used to.
      fontFamily: {
        sans: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        heading: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        body: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["var(--font-sans)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          DEFAULT: "hsl(var(--brand))",
          foreground: "hsl(var(--brand-foreground))",
          light: "hsl(var(--brand-light))",
          // Brand blue that has to be READ: text, links and the focus ring.
          // See the note on --brand-ink in globals.css.
          ink: "hsl(var(--brand-ink))",
        },
        midnight: {
          DEFAULT: "hsl(var(--midnight))",
          foreground: "hsl(var(--midnight-foreground))",
          light: "hsl(var(--midnight-light))",
          // The brand as text on the always-dark slab (see globals.css).
          accent: "hsl(var(--midnight-accent))",
        },
        surface: {
          DEFAULT: "hsl(var(--surface))",
          alt: "hsl(var(--surface-alt))",
        },
        ink: "hsl(var(--ink))",
        // Reserved meaning. Marks use the plain step with a label beside them;
        // words use -ink. Chart and overdue colours stay CSS variables, read
        // through lib/constants/chart-palette.ts.
        status: {
          good: "hsl(var(--status-good))",
          warning: "hsl(var(--status-warning))",
          critical: "hsl(var(--status-critical))",
          "good-ink": "hsl(var(--status-good-ink))",
          "critical-ink": "hsl(var(--status-critical-ink))",
        },
        admin: {
          accent: "hsl(var(--admin-accent))",
          "accent-foreground": "hsl(var(--admin-accent-foreground))",
          "accent-light": "hsl(var(--admin-accent-light))",
          "sidebar-bg": "hsl(var(--admin-sidebar-bg))",
          "sidebar-foreground": "hsl(var(--admin-sidebar-foreground))",
          ring: "hsl(var(--admin-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      // No custom keyframes here: app motion lives in the MOTION SYSTEM block
      // of globals.css, with one curve and four durations. The settings pages'
      // own `settings-enter` was retired on 2026-10-18 for the shared arrival.
    },
  },
  plugins: [tailwindcssAnimate],
};

export default config;
