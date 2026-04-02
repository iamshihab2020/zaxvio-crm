import type { Metadata } from "next";
import { Space_Grotesk, DM_Sans } from "next/font/google";
import { ThemeProvider } from "@/components/theme-provider";
import { RefreshOnNav } from "@/components/refresh-on-nav";
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
      className={`${spaceGrotesk.variable} ${dmSans.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen font-body antialiased">
        <ThemeProvider>
          <RefreshOnNav />
          {children}
          <Toaster position="bottom-right" richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
