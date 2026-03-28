import { getPublicBookingStatus } from "@/actions/bookings";
import { notFound } from "next/navigation";
import { BookingStatusClient } from "./booking-status-client";

interface BookingStatusPageProps {
  params: Promise<{ slug: string; id: string }>;
}

export default async function BookingStatusPage({ params }: BookingStatusPageProps) {
  const { slug, id } = await params;
  const result = await getPublicBookingStatus(slug, id);

  if (!result.data) {
    notFound();
  }

  return (
    <BookingStatusClient
      slug={slug}
      bookingId={id}
      initialData={result.data}
    />
  );
}
