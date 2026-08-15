"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPhoto, IconTrash, IconUpload, IconLayoutColumns } from "@tabler/icons-react";
import { getJobPhotos, deleteJobPhoto } from "@/actions/jobs";
import { getStorageUrl } from "@/lib/storage-url";
import { PhotoTagPill } from "./photo-tag-pill";
import { JobPhotoLightbox } from "./job-photo-lightbox";
import type { LightboxPhoto } from "./job-photo-lightbox";
import { JobPhotoCompare } from "./job-photo-compare";
import { JobPhotoUploadModal } from "./job-photo-upload-modal";

interface Photo {
  id: string;
  storagePath: string;
  caption: string | null;
  tag: "before" | "after" | "general";
  uploadedBy: string | null;
  uploaderName: string | null;
  fileSize: number | null;
  createdAt: string;
}

interface JobDetailPhotosProps {
  jobId: string;
  customerId?: string;
}

function toPublicUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return getStorageUrl(storagePath);
}

function toLightbox(p: Photo): LightboxPhoto {
  return {
    id: p.id,
    storagePath: p.storagePath,
    publicUrl: toPublicUrl(p.storagePath),
    caption: p.caption,
    tag: p.tag,
    uploaderName: p.uploaderName,
    createdAt: p.createdAt,
  };
}

export function JobDetailPhotos({ jobId, customerId }: JobDetailPhotosProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [compareOpen, setCompareOpen] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getJobPhotos(jobId).then((res) => {
      if (res.data) setPhotos(res.data);
      setLoading(false);
    });
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(photoId: string) {
    const result = await deleteJobPhoto(jobId, photoId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success("Photo deleted");
    }
  }

  const lightboxPhotos = photos.map(toLightbox);
  const beforePhotos = lightboxPhotos.filter((p) => p.tag === "before");
  const afterPhotos = lightboxPhotos.filter((p) => p.tag === "after");
  const canCompare = beforePhotos.length > 0 && afterPhotos.length > 0;

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-20" />
          <Skeleton className="h-7 w-28" />
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="aspect-square rounded-md" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-body font-medium text-foreground">
          {photos.length > 0
            ? `${photos.length} photo${photos.length !== 1 ? "s" : ""}`
            : "Photos"}
        </p>
        <div className="flex items-center gap-2">
          {canCompare && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCompareOpen(true)}
              className="gap-1.5 text-xs"
            >
              <IconLayoutColumns className="h-3.5 w-3.5" />
              Compare
            </Button>
          )}
          <Button
            size="sm"
            onClick={() => setUploadOpen(true)}
            className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 text-xs"
          >
            <IconUpload className="h-3.5 w-3.5" />
            Upload Photo
          </Button>
        </div>
      </div>

      {photos.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-10 text-center">
          <IconPhoto className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground font-body">No photos yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 font-body">
            Upload before/after photos to document this job
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {photos.map((photo, index) => (
            <div
              key={photo.id}
              className="group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-muted"
              onClick={() => setLightboxIndex(index)}
            >
              <img
                src={toPublicUrl(photo.storagePath)}
                alt={photo.caption ?? "Job photo"}
                className="h-full w-full object-cover transition-transform group-hover:scale-105"
              />
              {/* Tag pill */}
              <div className="absolute top-1.5 left-1.5">
                <PhotoTagPill tag={photo.tag} />
              </div>
              {/* Delete button */}
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); handleDelete(photo.id); }}
                className="absolute top-1.5 right-1.5 rounded-md bg-black/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100 hover:bg-red-600/80"
              >
                <IconTrash className="h-3.5 w-3.5" />
              </button>
              {/* Uploader overlay */}
              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent p-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <p className="text-[10px] text-white/90 font-body truncate">
                  {photo.uploaderName ?? "—"}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Lightbox */}
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

      {/* Compare */}
      <JobPhotoCompare
        beforePhotos={beforePhotos}
        afterPhotos={afterPhotos}
        open={compareOpen}
        onOpenChange={setCompareOpen}
      />

      {/* Upload */}
      <JobPhotoUploadModal
        jobId={jobId}
        customerId={customerId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={load}
      />
    </div>
  );
}
