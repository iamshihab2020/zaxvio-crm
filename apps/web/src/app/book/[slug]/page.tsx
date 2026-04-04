import { getPublicBookingPage } from "@/actions/bookings";
import { BookingFormClient } from "./booking-form-client";
import { notFound } from "next/navigation";

interface BookingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ embed?: string; source?: string }>;
}

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { slug } = await params;
  const { embed, source } = await searchParams;
  const result = await getPublicBookingPage(slug);

  if (!result.data) {
    notFound();
  }

  const isEmbed = embed === "1";
  const bookingSource = (["portal", "embed", "widget"].includes(source ?? "") ? source : "portal") as
    | "portal"
    | "embed"
    | "widget";

  return (
    <BookingFormClient
      slug={slug}
      businessName={result.data.businessName}
      logoUrl={result.data.logoUrl}
      serviceTypes={result.data.serviceTypes}
      embed={isEmbed}
      source={bookingSource}
    />
  );
}
