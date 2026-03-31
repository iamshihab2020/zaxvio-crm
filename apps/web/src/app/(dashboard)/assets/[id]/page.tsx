import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getEquipmentItem } from "@/actions/equipment";
import { AssetDetailClient } from "./asset-detail-client";

interface AssetDetailPageProps {
  params: Promise<{ id: string }>;
}

export const metadata: Metadata = {
  title: "Asset Details",
  description: "View asset information and service history",
};

export default async function AssetDetailPage({
  params,
}: AssetDetailPageProps) {
  const { id } = await params;
  const { data: asset, error } = await getEquipmentItem(id);

  if (error || !asset) {
    notFound();
  }

  return <AssetDetailClient asset={asset} />;
}
