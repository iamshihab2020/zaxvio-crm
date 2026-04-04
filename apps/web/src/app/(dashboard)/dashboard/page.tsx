import { getDashboardStats } from "@/actions/dashboard";
import { DashboardPageClient } from "./dashboard-page-client";

export const metadata = {
  title: "Dashboard",
};

export default async function DashboardPage() {
  const result = await getDashboardStats();

  return <DashboardPageClient initialStats={result.data ?? null} />;
}
