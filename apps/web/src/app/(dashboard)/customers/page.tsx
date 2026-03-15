import type { Metadata } from "next";
import { CustomersPageClient } from "./customers-page-client";

export const metadata: Metadata = {
  title: "Customers | HVACPro",
  description: "Manage your customers",
};

export default function CustomersPage() {
  return <CustomersPageClient />;
}
