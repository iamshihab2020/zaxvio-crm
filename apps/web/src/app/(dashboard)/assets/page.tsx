import type { Metadata } from "next";
import { getEquipment } from "@/actions/equipment";
import { AssetsPageClient } from "./assets-page-client";

export const metadata: Metadata = {
  title: "Assets",
  description: "Manage equipment and assets across all customers",
};

export default async function AssetsPage() {
  const result = await getEquipment({ page: 1, limit: 15 });

  return (
    <AssetsPageClient
      initialAssets={(result.data ?? []) as never[]}
      initialPagination={result.pagination as never}
    />
  );
}
