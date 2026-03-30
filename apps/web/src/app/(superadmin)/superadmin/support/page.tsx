import { getAuditLog, getImpersonationLog } from "@/actions/admin";
import { SupportPageClient } from "./support-page-client";

export default async function SupportPage() {
  const [auditResult, impersonationResult] = await Promise.all([
    getAuditLog({ page: 1, limit: 50 }),
    getImpersonationLog({ page: 1, limit: 50 }),
  ]);

  return (
    <SupportPageClient
      auditLog={auditResult.data ?? []}
      auditPagination={auditResult.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 0 }}
      impersonationLog={impersonationResult.data ?? []}
      impersonationPagination={impersonationResult.pagination ?? { page: 1, limit: 50, total: 0, totalPages: 0 }}
    />
  );
}
