"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { IconFile, IconTrash, IconUpload, IconDownload } from "@tabler/icons-react";
import { getJobDocuments, deleteJobDocument } from "@/actions/jobs";
import { getStorageUrl } from "@/lib/storage-url";
import { JobPhotoUploadModal } from "./job-photo-upload-modal";

interface Document {
  id: string;
  fileName: string;
  storagePath: string;
  fileSize: number | null;
  mimeType: string | null;
  uploadedBy: string | null;
  uploaderName: string | null;
  createdAt: string;
}

interface JobDetailDocumentsProps {
  jobId: string;
  customerId?: string;
}

function formatBytes(bytes: number | null): string {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeLabel(mimeType: string | null): string {
  if (!mimeType) return "FILE";
  if (mimeType === "application/pdf") return "PDF";
  if (mimeType.includes("word")) return "DOC";
  if (mimeType.includes("excel") || mimeType.includes("spreadsheet")) return "XLS";
  if (mimeType === "text/plain") return "TXT";
  if (mimeType === "text/csv") return "CSV";
  return mimeType.split("/")[1]?.toUpperCase().slice(0, 4) ?? "FILE";
}

function getDocumentUrl(storagePath: string): string {
  if (storagePath.startsWith("http")) return storagePath;
  return getStorageUrl(storagePath);
}

export function JobDetailDocuments({ jobId, customerId }: JobDetailDocumentsProps) {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadOpen, setUploadOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getJobDocuments(jobId).then((res) => {
      if (res.data) setDocuments(res.data);
      setLoading(false);
    });
  }, [jobId]);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(docId: string) {
    const result = await deleteJobDocument(jobId, docId);
    if (result.error) {
      toast.error(result.error);
    } else {
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
      toast.success("Document deleted");
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-24" />
          <Skeleton className="h-7 w-32" />
        </div>
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-md" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-sm font-body font-medium text-foreground">
          {documents.length > 0
            ? `${documents.length} document${documents.length !== 1 ? "s" : ""}`
            : "Documents"}
        </p>
        <Button
          size="sm"
          onClick={() => setUploadOpen(true)}
          className="gap-1.5 bg-brand text-brand-foreground hover:bg-brand/90 text-xs"
        >
          <IconUpload className="h-3.5 w-3.5" />
          Upload Document
        </Button>
      </div>

      {documents.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-8 text-center">
          <IconFile className="h-8 w-8 text-muted-foreground mb-2" />
          <p className="text-sm text-muted-foreground font-body">No documents yet</p>
          <p className="text-xs text-muted-foreground/70 mt-1 font-body">
            Attach permits, warranties, or inspection reports
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {documents.map((doc) => (
            <div
              key={doc.id}
              className="group flex items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
                <IconFile className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-body font-medium text-foreground truncate">
                  {doc.fileName}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                    {getMimeLabel(doc.mimeType)}
                  </Badge>
                  {doc.fileSize && (
                    <span className="text-xs text-muted-foreground font-body">
                      {formatBytes(doc.fileSize)}
                    </span>
                  )}
                  {doc.uploaderName && (
                    <span className="text-xs text-muted-foreground font-body hidden sm:inline">
                      {doc.uploaderName}
                    </span>
                  )}
                  <span className="text-xs text-muted-foreground font-body">
                    {new Date(doc.createdAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  asChild
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                >
                  <a
                    href={getDocumentUrl(doc.storagePath)}
                    target="_blank"
                    rel="noopener noreferrer"
                    download={doc.fileName}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <IconDownload className="h-3.5 w-3.5" />
                  </a>
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(doc.id)}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

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
