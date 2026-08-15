"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { IconPhoto, IconFile, IconUpload, IconX } from "@tabler/icons-react";
import { uploadJobFile, addJobPhoto, addJobDocument } from "@/actions/jobs";

type UploadMode = "photo" | "document";
type PhotoTag = "before" | "after" | "general";

interface JobPhotoUploadModalProps {
  jobId: string;
  customerId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

const TAG_OPTIONS: { value: PhotoTag; label: string; color: string }[] = [
  { value: "before", label: "Before", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "after", label: "After", color: "bg-green-100 text-green-700 border-green-200" },
  { value: "general", label: "General", color: "bg-gray-100 text-gray-700 border-gray-200" },
];

export function JobPhotoUploadModal({
  jobId,
  customerId,
  open,
  onOpenChange,
  onUploaded,
}: JobPhotoUploadModalProps) {
  const [mode, setMode] = useState<UploadMode>("photo");
  const [tag, setTag] = useState<PhotoTag>("general");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleClose() {
    if (uploading) return;
    setFile(null);
    setPreview(null);
    setTag("general");
    setMode("photo");
    onOpenChange(false);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0];
    if (!selected) return;

    const isPhoto = selected.type.startsWith("image/");
    const maxBytes = isPhoto ? 20 * 1024 * 1024 : 50 * 1024 * 1024;
    const limit = isPhoto ? "20MB" : "50MB";

    if (selected.size > maxBytes) {
      toast.error(`File too large. Maximum size is ${limit}.`);
      e.target.value = "";
      return;
    }

    setFile(selected);

    if (isPhoto) {
      const reader = new FileReader();
      reader.onload = (ev) => setPreview(ev.target?.result as string);
      reader.readAsDataURL(selected);
    } else {
      setPreview(null);
    }
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);

    // Convert File to base64 client-side — File objects cannot be passed to Server Actions
    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
    const base64 = btoa(binary);

    const uploadResult = await uploadJobFile(
      jobId,
      { base64, filename: file.name, mimeType: file.type },
      tag,
    );
    if (uploadResult.error || !uploadResult.data) {
      toast.error(uploadResult.error ?? "Upload failed");
      setUploading(false);
      return;
    }

    const { storagePath, fileSize, mimeType } = uploadResult.data;

    if (mode === "photo") {
      const result = await addJobPhoto(jobId, {
        storagePath,
        tag,
        fileSize,
      });
      if (result.error) {
        toast.error(result.error);
        setUploading(false);
        return;
      }
    } else {
      const result = await addJobDocument(jobId, {
        storagePath,
        fileName: file.name,
        fileSize,
        mimeType,
        customerId,
      });
      if (result.error) {
        toast.error(result.error);
        setUploading(false);
        return;
      }
    }

    toast.success(mode === "photo" ? "Photo uploaded" : "Document uploaded");
    setUploading(false);
    handleClose();
    onUploaded();
  }

  const accept = mode === "photo" ? "image/*" : ".pdf,.doc,.docx,.xls,.xlsx,.txt,.csv";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-heading">Upload File</DialogTitle>
        </DialogHeader>

        {/* Mode toggle */}
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            onClick={() => { setMode("photo"); setFile(null); setPreview(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-body transition-colors ${
              mode === "photo" ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <IconPhoto className="h-4 w-4" />
            Photo
          </button>
          <button
            type="button"
            onClick={() => { setMode("document"); setFile(null); setPreview(null); }}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-sm font-body transition-colors ${
              mode === "document" ? "bg-brand text-brand-foreground" : "bg-background text-muted-foreground hover:bg-muted"
            }`}
          >
            <IconFile className="h-4 w-4" />
            Document
          </button>
        </div>

        {/* File picker area */}
        <div
          className="relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-muted/20 p-6 cursor-pointer hover:bg-muted/40 transition-colors"
          onClick={() => inputRef.current?.click()}
        >
          {preview ? (
            <img src={preview} alt="Preview" className="max-h-40 rounded-md object-cover" />
          ) : file ? (
            <div className="flex items-center gap-2 text-sm font-body text-foreground">
              <IconFile className="h-5 w-5 text-muted-foreground" />
              <span className="truncate max-w-[200px]">{file.name}</span>
            </div>
          ) : (
            <>
              <IconUpload className="h-8 w-8 text-muted-foreground" />
              <p className="text-sm font-body text-muted-foreground text-center">
                {mode === "photo"
                  ? "Tap to take a photo or choose from library"
                  : "Tap to select a document (PDF, DOC, etc.)"}
              </p>
              <p className="text-xs text-muted-foreground/70">
                Max {mode === "photo" ? "20MB" : "50MB"}
              </p>
            </>
          )}
          {file && (
            <button
              type="button"
              className="absolute top-2 right-2 rounded-full bg-muted p-1 text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null); }}
            >
              <IconX className="h-3.5 w-3.5" />
            </button>
          )}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={accept}
          capture={mode === "photo" ? "environment" : undefined}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Tag selector — photos only */}
        {mode === "photo" && (
          <div>
            <p className="mb-2 text-xs font-body text-muted-foreground">Tag</p>
            <div className="flex gap-2">
              {TAG_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setTag(opt.value)}
                  className={`flex-1 rounded-md border py-1.5 text-xs font-body transition-all ${
                    tag === opt.value
                      ? opt.color + " font-medium"
                      : "border-border bg-background text-muted-foreground hover:bg-muted"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <Button variant="outline" className="flex-1" onClick={handleClose} disabled={uploading}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-brand text-brand-foreground hover:bg-brand/90"
            onClick={handleUpload}
            disabled={!file || uploading}
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
