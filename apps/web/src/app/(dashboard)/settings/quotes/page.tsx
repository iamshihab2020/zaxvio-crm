import type { Metadata } from "next";
import { QuoteSettingsClient } from "./quote-settings-client";

export const metadata: Metadata = {
  title: "Quote Settings",
  description: "Customize your quote PDF footer and terms",
};

export default function QuoteSettingsPage() {
  return <QuoteSettingsClient />;
}
