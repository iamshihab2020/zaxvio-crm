"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { IconPhoto, IconTrash, IconUpload } from "@tabler/icons-react";
import { getJobPhotos, deleteJobPhoto } from "@/actions/jobs";

interface Photo {
  id: string;
  storagePath: string;
  caption: string | null;
  createdAt: string;
}

interface JobDetailPhotosProps {
  jobId: string;
}

export function JobDetailPhotos({ jobId }: JobDetailPhotosProps) {
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getJobPhotos(jobId).then((res) => {
      if (res.data) setPhotos(res.data);
      setLoading(false);
    });
  }, [jobId]);

  async function handleDelete(photoId: string) {
    const result = await deleteJobPhoto(jobId, photoId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      toast.success("Photo deleted");
    }
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="aspect-square rounded-md" />
        ))}
      </div>
    );
  }

  if (photos.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
        <IconPhoto className="h-8 w-8 text-muted-foreground mb-2" />
        <p className="text-sm text-muted-foreground font-body">
          No photos yet
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Upload photos from the mobile app
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      {photos.map((photo) => (
        <div
          key={photo.id}
          className="group relative aspect-square rounded-md border border-border bg-muted/20 overflow-hidden"
        >
          <div className="flex items-center justify-center h-full text-muted-foreground">
            <IconPhoto className="h-8 w-8" />
          </div>
          {photo.caption && (
            <div className="absolute bottom-0 inset-x-0 bg-black/50 px-2 py-1">
              <p className="text-xs text-white truncate">{photo.caption}</p>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleDelete(photo.id)}
            className="absolute top-2 right-2 h-7 w-7 bg-black/50 text-white opacity-0 group-hover:opacity-100 hover:bg-black/70"
          >
            <IconTrash className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
