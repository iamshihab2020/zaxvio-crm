"use client";

import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPhoto } from "@tabler/icons-react";
import { Pagination } from "@/components/reusable/pagination";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { useCustomerPhotos } from "@/hooks/queries";
import { getStorageUrl } from "@/lib/storage-url";
import { PhotoTagPill } from "@/components/dashboard/jobs/photo-tag-pill";
import { JobPhotoLightbox } from "@/components/dashboard/jobs/job-photo-lightbox";
import type { LightboxPhoto } from "@/components/dashboard/jobs/job-photo-lightbox";

interface CustomerPhoto {
  id: string;
  jobId: string;
  storagePath: string;
  caption: string | null;
  tag: "before" | "after" | "general";
  uploaderName: string | null;
  createdAt: string;
  jobTitle: string;
  jobScheduledDate: string;
  jobNumber: string;
}

interface CustomerPhotosTabProps {
  customerId: string;
}

function toPublicUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return getStorageUrl(storagePath);
}

const PAGE_SIZE = 60;

export function CustomerPhotosTab({ customerId }: CustomerPhotosTabProps) {
  const [page, setPage] = useState(1);
  const [lightboxPhotos, setLightboxPhotos] = useState<LightboxPhoto[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  // The endpoint used to return every photo across every job for this customer
  // in one unbounded response (CUST-15).
  const photosQuery = useCustomerPhotos(customerId, { page, limit: PAGE_SIZE });
  const photos: CustomerPhoto[] = (photosQuery.data?.data as CustomerPhoto[]) ?? [];
  const pagination = photosQuery.data?.pagination;
  const loading = photosQuery.isLoading;
  const loadFailed = photosQuery.isError || !!photosQuery.data?.error;

  function openLightbox(allPhotos: LightboxPhoto[], index: number) {
    setLightboxPhotos(allPhotos);
    setLightboxIndex(index);
  }

  if (loadFailed && !loading) {
    return (
      <LoadErrorState
        title="Could not load photos"
        message={photosQuery.data?.error}
        onRetry={() => photosQuery.refetch()}
        isRetrying={photosQuery.isFetching}
      />
    );
  }

  if (loading) {
    return (
      <div className="space-y-6 p-1">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <div className="grid grid-cols-4 gap-2">
              {Array.from({ length: 4 }).map((_, j) => (
                <Skeleton key={j} className="aspect-square rounded-md" />
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
        <IconPhoto className="h-10 w-10 text-muted-foreground mb-3" />
        <p className="text-sm font-body font-medium text-foreground">No photos</p>
        <p className="text-xs text-muted-foreground mt-1 font-body">
          Photos uploaded to this customer's jobs will appear here
        </p>
      </div>
    );
  }

  // Group photos by jobId
  const groups = photos.reduce<Record<string, { meta: CustomerPhoto; items: CustomerPhoto[] }>>(
    (acc, photo) => {
      if (!acc[photo.jobId]) {
        acc[photo.jobId] = { meta: photo, items: [] };
      }
      acc[photo.jobId].items.push(photo);
      return acc;
    },
    {},
  );

  return (
    <div className="space-y-6 p-1">
      {Object.values(groups).map(({ meta, items }) => {
        const groupLightbox: LightboxPhoto[] = items.map((p) => ({
          id: p.id,
          storagePath: p.storagePath,
          publicUrl: toPublicUrl(p.storagePath),
          caption: p.caption,
          tag: p.tag,
          uploaderName: p.uploaderName,
          createdAt: p.createdAt,
        }));

        return (
          <div key={meta.jobId}>
            <div className="mb-2 flex items-baseline gap-2">
              <p className="text-sm font-body font-medium text-foreground">
                {meta.jobTitle}
              </p>
              <span className="text-xs text-muted-foreground font-body">
                {meta.jobNumber} ·{" "}
                {new Date(meta.jobScheduledDate).toLocaleDateString("en-US", {
                  month: "short",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            </div>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-5">
              {items.map((photo, idx) => (
                <div
                  key={photo.id}
                  className="group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-muted"
                  onClick={() => openLightbox(groupLightbox, idx)}
                >
                  <img
                    src={toPublicUrl(photo.storagePath)}
                    alt={photo.caption ?? "Job photo"}
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute top-1 left-1">
                    <PhotoTagPill tag={photo.tag} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      })}

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          entityName="photo"
        />
      )}

      {lightboxIndex !== null && (
        <JobPhotoLightbox
          photos={lightboxPhotos}
          initialIndex={lightboxIndex}
          open={lightboxIndex !== null}
          onOpenChange={(open) => { if (!open) setLightboxIndex(null); }}
          currentIndex={lightboxIndex}
          onIndexChange={setLightboxIndex}
        />
      )}
    </div>
  );
}
