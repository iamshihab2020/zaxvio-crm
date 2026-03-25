import type { Metadata } from "next";
import { InvoiceSettingsClient } from "./invoice-settings-client";

export const metadata: Metadata = {
  title: "Invoice Settings",
  description: "Customize your invoice appearance and details",
};

export default function InvoiceSettingsPage() {
  return <InvoiceSettingsClient />;
}
