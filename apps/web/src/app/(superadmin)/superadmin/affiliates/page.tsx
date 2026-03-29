import { getAdminTenants } from "@/actions/admin";
import { AffiliatesPageClient } from "./affiliates-page-client";

export default async function AffiliatesPage() {
  // Fetch tenants that came from affiliate referrals
  const result = await getAdminTenants({ limit: 100 });
  const allTenants = result.data ?? [];
  const affiliateTenants = allTenants.filter(
    (t: { referralSource: string | null }) => t.referralSource === "affiliate",
  );

  return <AffiliatesPageClient tenants={affiliateTenants} totalTenants={allTenants.length} />;
}
