import { getPublicBookingPage } from "@/actions/bookings";
import { BookingFormClient } from "./booking-form-client";
import { notFound } from "next/navigation";

interface BookingPageProps {
  params: Promise<{ slug: string }>;
}

export default async function BookingPage({ params }: BookingPageProps) {
  const { slug } = await params;
  const result = await getPublicBookingPage(slug);

  if (!result.data) {
    notFound();
  }

  return (
    <BookingFormClient
      slug={slug}
      businessName={result.data.businessName}
      logoUrl={result.data.logoUrl}
      serviceTypes={result.data.serviceTypes}
    />
  );
}
