import { DashboardSkeleton } from "@/components/dashboard/home/dashboard-skeleton";

export default function DashboardLoading() {
  return (
    <section className="p-6">
      <DashboardSkeleton />
    </section>
  );
}
