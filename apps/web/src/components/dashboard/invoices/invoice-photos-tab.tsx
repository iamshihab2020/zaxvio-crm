"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPhoto } from "@tabler/icons-react";
import { getJobPhotos } from "@/actions/jobs";
import { getStorageUrl } from "@/lib/storage-url";
import { PhotoTagPill } from "@/components/dashboard/jobs/photo-tag-pill";
import { JobPhotoLightbox } from "@/components/dashboard/jobs/job-photo-lightbox";
import type { LightboxPhoto } from "@/components/dashboard/jobs/job-photo-lightbox";

interface Photo {
  id: string;
  storagePath: string;
  caption: string | null;
  tag: "before" | "after" | "general";
  uploaderName: string | null;
  createdAt: string;
}

interface InvoicePhotosTabProps {
  jobId: string;
}

function toPublicUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return getStorageUrl(storagePath);
}

export function InvoicePhotosTab({ jobId }: InvoicePhotosTabProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    getJobPhotos(jobId).then((res) => {
      if (res.data) setPhotos(res.data);
      setLoading(false);
    });
  }, [jobId]);

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  const lightboxPhotos: LightboxPhoto[] = photos.map((p) => ({
    id: p.id,
    storagePath: p.storagePath,
    publicUrl: toPublicUrl(p.storagePath),
    caption: p.caption,
    tag: p.tag,
    uploaderName: p.uploaderName,
    createdAt: p.createdAt,
  }));

  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center">
        <IconPhoto className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground font-body">No photos on this job</p>
        <p className="text-xs text-muted-foreground/70 mt-1 font-body">
          Upload photos on the job record first
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {selected.size > 0 && (
        <p className="text-xs text-muted-foreground font-body">
          {selected.size} photo{selected.size !== 1 ? "s" : ""} selected for invoice
        </p>
      )}
      <p className="text-xs text-muted-foreground font-body">
        Select photos to include in the invoice PDF
      </p>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {photos.map((photo, index) => {
          const isSelected = selected.has(photo.id);
          return (
            <div
              key={photo.id}
              className={`group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-muted transition-all ${
                isSelected ? "ring-2 ring-brand ring-offset-1" : ""
              }`}
              onClick={() => toggleSelect(photo.id)}
            >
              <img
                src={toPublicUrl(photo.storagePath)}
                alt={photo.caption ?? "Job photo"}
                className="h-full w-full object-cover"
                onClick={(e) => {
                  // Long-press intent: open lightbox on separate click
                  if ((e as unknown as { detail: number }).detail === 2) {
                    e.stopPropagation();
                    setLightboxIndex(index);
                  }
                }}
              />
              <div className="absolute top-1 left-1">
                <PhotoTagPill tag={photo.tag} />
              </div>
              {isSelected && (
                <div className="absolute inset-0 bg-brand/20 flex items-center justify-center">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-brand text-brand-foreground text-xs font-bold">
                    ✓
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

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
