import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

// One family for everything: headings, body, labels and figures. Every
// Tailwind font slot (`font-heading`, `font-body`, `font-mono`) points at this
// variable, so components keep their class names and all of them get Inter.
// It is the variable font, so every weight the app uses comes from one file.
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Zaxvio — Service Management Software",
    template: "%s | Zaxvio",
  },
  description:
    "All-in-one service management for field service businesses. Scheduling, invoicing, team management, and customer tracking — built for teams that get work done.",
  metadataBase: new URL(process.env.FRONTEND_URL || "https://zaxvio.com"),
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: "Zaxvio",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "Zaxvio — Service Management Software",
    description:
      "All-in-one service management for field service businesses.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={inter.variable}
      suppressHydrationWarning
    >
      <head>
        {/*
          Marks the document as scripted before first paint. The scroll-reveal
          rules in globals.css hide their targets only under `html.js`, so a
          reader without JavaScript — or one whose bundle is still in flight —
          gets the server-rendered page at full opacity instead of a blank one.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html: `document.documentElement.classList.add('js')`,
          }}
        />
      </head>
      <body className="min-h-screen font-body antialiased">
        {/* No MotionProvider here, on purpose (LAND-09). The booking portal,
            quote page, auth pages and unsubscribe page import nothing from
            `motion/react`, and a provider at the root put it into all of their
            bundles anyway. It sits in the five route-group layouts that do
            use motion instead; see components/motion-provider.tsx. */}
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
        {/*
          Real-user Core Web Vitals, reported to Vercel Speed Insights. Renders
          nothing and injects its collector from this app's own origin
          (/_vercel/speed-insights/script.js), so no CSP or security header in
          next.config.mjs has to be relaxed for it. Outside a Vercel deployment
          it is inert — local `pnpm dev` sends nothing.
        */}
        <SpeedInsights />
      </body>
    </html>
  );
}
