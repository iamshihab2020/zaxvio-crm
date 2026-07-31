import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans, DM_Mono } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "sonner";
import "./globals.css";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
  display: "swap",
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-body",
  display: "swap",
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
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
      className={`${spaceGrotesk.variable} ${dmSans.variable} ${dmMono.variable}`}
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
        <ThemeProvider>
          <QueryProvider>
            {children}
          </QueryProvider>
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
