"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import type { LightboxPhoto } from "./job-photo-lightbox";

interface JobPhotoCompareProps {
  beforePhotos: LightboxPhoto[];
  afterPhotos: LightboxPhoto[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function JobPhotoCompare({
  beforePhotos,
  afterPhotos,
  open,
  onOpenChange,
}: JobPhotoCompareProps) {
  const [beforeIndex, setBeforeIndex] = useState(0);
  const [afterIndex, setAfterIndex] = useState(0);

  const before = beforePhotos[beforeIndex];
  const after = afterPhotos[afterIndex];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl">
        <DialogHeader>
          <DialogTitle className="font-heading">Before / After</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-4">
          {/* Before */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 font-body">
                Before
              </span>
              <span className="text-xs text-muted-foreground font-body">
                {beforeIndex + 1} / {beforePhotos.length}
              </span>
            </div>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {before && (
                <img
                  src={before.publicUrl}
                  alt="Before"
                  className="w-full h-full object-cover"
                />
              )}
              {beforePhotos.length > 1 && (
                <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setBeforeIndex((i) => Math.max(0, i - 1))}
                    disabled={beforeIndex === 0}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setBeforeIndex((i) => Math.min(beforePhotos.length - 1, i + 1))}
                    disabled={beforeIndex === beforePhotos.length - 1}
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {before?.caption && (
              <p className="text-xs text-muted-foreground font-body">{before.caption}</p>
            )}
          </div>

          {/* After */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 font-body">
                After
              </span>
              <span className="text-xs text-muted-foreground font-body">
                {afterIndex + 1} / {afterPhotos.length}
              </span>
            </div>
            <div className="relative aspect-video bg-muted rounded-lg overflow-hidden">
              {after && (
                <img
                  src={after.publicUrl}
                  alt="After"
                  className="w-full h-full object-cover"
                />
              )}
              {afterPhotos.length > 1 && (
                <div className="absolute inset-x-0 bottom-2 flex justify-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setAfterIndex((i) => Math.max(0, i - 1))}
                    disabled={afterIndex === 0}
                  >
                    <IconChevronLeft className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 bg-black/50 text-white hover:bg-black/70"
                    onClick={() => setAfterIndex((i) => Math.min(afterPhotos.length - 1, i + 1))}
                    disabled={afterIndex === afterPhotos.length - 1}
                  >
                    <IconChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
            {after?.caption && (
              <p className="text-xs text-muted-foreground font-body">{after.caption}</p>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
