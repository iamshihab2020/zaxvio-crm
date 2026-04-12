import { getPublicBookingPage } from "@/actions/bookings";
import { BookingFormClient } from "./booking-form-client";
import { notFound } from "next/navigation";

interface BookingPageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    embed?: string;
    source?: string;
    name?: string;
    email?: string;
    phone?: string;
    address?: string;
    service?: string;
    quoteId?: string;
  }>;
}

export default async function BookingPage({ params, searchParams }: BookingPageProps) {
  const { slug } = await params;
  const { embed, source, name, email, phone, address, service, quoteId } = await searchParams;
  const result = await getPublicBookingPage(slug);

  if (!result.data) {
    notFound();
  }

  const isEmbed = embed === "1";
  const bookingSource = (["portal", "embed", "widget"].includes(source ?? "") ? source : "portal") as
    | "portal"
    | "embed"
    | "widget";

  // Build initial customer data from URL params (used by quote acceptance flow)
  const initialCustomer =
    name || email || phone || address
      ? {
          customerName: name ?? "",
          customerEmail: email ?? "",
          customerPhone: phone ?? "",
          address: address ?? "",
        }
      : undefined;

  // Pre-select service type if provided via URL param
  const initialService =
    service && result.data.serviceTypes.includes(service) ? service : undefined;

  return (
    <BookingFormClient
      slug={slug}
      businessName={result.data.businessName}
      logoUrl={result.data.logoUrl}
      serviceTypes={result.data.serviceTypes}
      embed={isEmbed}
      source={bookingSource}
      initialCustomer={initialCustomer}
      initialService={initialService}
      quoteId={quoteId}
    />
  );
}
