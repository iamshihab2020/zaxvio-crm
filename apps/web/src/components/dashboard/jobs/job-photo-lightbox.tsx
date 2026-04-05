"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { PhotoTagPill } from "./photo-tag-pill";

export interface LightboxPhoto {
  id: string;
  storagePath: string;
  publicUrl: string;
  caption?: string | null;
  tag: "before" | "after" | "general";
  uploaderName?: string | null;
  createdAt: string;
}

interface JobPhotoLightboxProps {
  photos: LightboxPhoto[];
  initialIndex: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentIndex: number;
  onIndexChange: (index: number) => void;
}

export function JobPhotoLightbox({
  photos,
  open,
  onOpenChange,
  currentIndex,
  onIndexChange,
}: JobPhotoLightboxProps) {
  const photo = photos[currentIndex];

  useEffect(() => {
    if (!open) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "ArrowLeft" && currentIndex > 0) onIndexChange(currentIndex - 1);
      if (e.key === "ArrowRight" && currentIndex < photos.length - 1) onIndexChange(currentIndex + 1);
      if (e.key === "Escape") onOpenChange(false);
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, currentIndex, photos.length, onIndexChange, onOpenChange]);

  if (!photo) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl bg-black border-black p-0 overflow-hidden">
        {/* Close button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-3 right-3 z-10 text-white hover:bg-white/20"
          onClick={() => onOpenChange(false)}
        >
          <IconX className="h-5 w-5" />
        </Button>

        {/* Nav arrows */}
        {currentIndex > 0 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute left-3 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
            onClick={() => onIndexChange(currentIndex - 1)}
          >
            <IconChevronLeft className="h-6 w-6" />
          </Button>
        )}
        {currentIndex < photos.length - 1 && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-3 top-1/2 -translate-y-1/2 z-10 text-white hover:bg-white/20"
            onClick={() => onIndexChange(currentIndex + 1)}
          >
            <IconChevronRight className="h-6 w-6" />
          </Button>
        )}

        {/* Image */}
        <div className="flex items-center justify-center bg-black min-h-[60vh] max-h-[80vh]">
          <img
            src={photo.publicUrl}
            alt={photo.caption ?? "Photo"}
            className="max-w-full max-h-[80vh] object-contain"
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 bg-black/90 px-4 py-3">
          <div className="flex items-center gap-2">
            <PhotoTagPill tag={photo.tag} />
            {photo.caption && (
              <span className="text-sm text-white/80 font-body">{photo.caption}</span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs text-white/50 font-body">
            {photo.uploaderName && <span>{photo.uploaderName}</span>}
            <span>{new Date(photo.createdAt).toLocaleDateString()}</span>
            <span>{currentIndex + 1} / {photos.length}</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
