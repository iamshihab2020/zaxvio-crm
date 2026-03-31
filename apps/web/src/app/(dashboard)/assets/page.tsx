import type { Metadata } from "next";
import { AssetsPageClient } from "./assets-page-client";

export const metadata: Metadata = {
  title: "Assets",
  description: "Manage equipment and assets across all customers",
};

export default function AssetsPage() {
  return <AssetsPageClient />;
}
