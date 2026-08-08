"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Pagination } from "@/components/reusable/pagination";
import { LoadErrorState } from "@/components/reusable/load-error-state";
import { DeleteConfirmDialog } from "@/components/reusable/delete-confirm-dialog";
import {
  useCustomerNotes,
  useCreateCustomerNote,
  useUpdateCustomerNote,
  useDeleteCustomerNote,
} from "@/hooks/queries";
import { IconNote, IconEdit, IconTrash, IconCheck, IconX } from "@tabler/icons-react";

interface Note {
  id: string;
  content: string;
  /** Null when an automation wrote it. */
  createdBy: string | null;
  authorName: string | null;
  createdByWorkflowId: string | null;
  authorWorkflowName: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * Who wrote this note.
 *
 * An automation is a real author and is named as one — "Quote follow-up"
 * rather than "Unknown", which reads as data loss. "Unknown" survives for the
 * genuine case: a note whose author has since been removed from the team.
 */
function authorLabel(note: Note): string {
  if (note.authorName) return note.authorName;
  if (note.authorWorkflowName) return `${note.authorWorkflowName} (automation)`;
  if (note.createdByWorkflowId) return "An automation";
  return "Unknown";
}

interface CustomerNotesTabProps {
  customerId: string;
}

const PAGE_SIZE = 20;
const MAX_NOTE = 5000;

export function CustomerNotesTab({ customerId }: CustomerNotesTabProps) {
  const [page, setPage] = useState(1);
  const [newNote, setNewNote] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingNote, setDeletingNote] = useState<Note | null>(null);

  // Was a hand-rolled `useState` + `useEffect` + full re-fetch after every write,
  // with a hard `limit: 50` and no pagination, so note 51 was unreachable and
  // nothing said so (CUST-15, CUST-22).
  const notesQuery = useCustomerNotes(customerId, { page, limit: PAGE_SIZE });
  const createMutation = useCreateCustomerNote(customerId);
  const updateMutation = useUpdateCustomerNote(customerId);
  const deleteMutation = useDeleteCustomerNote(customerId);

  const notes: Note[] = (notesQuery.data?.data as Note[]) ?? [];
  const pagination = notesQuery.data?.pagination;
  const loadFailed = notesQuery.isError || !!notesQuery.data?.error;

  function handleCreate() {
    const content = newNote.trim();
    if (!content || createMutation.isPending) return;
    createMutation.mutate(content, {
      onSuccess: (res) => {
        if (!res.error) {
          setNewNote("");
          setPage(1);
        }
      },
    });
  }

  function handleUpdate(noteId: string) {
    const content = editContent.trim();
    if (!content) return;
    updateMutation.mutate(
      { noteId, content },
      { onSuccess: (res) => { if (!res.error) setEditingId(null); } },
    );
  }

  function handleDelete() {
    if (!deletingNote) return;
    deleteMutation.mutate(deletingNote.id, {
      onSuccess: (res) => { if (!res.error) setDeletingNote(null); },
    });
  }

  if (notesQuery.isLoading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  if (loadFailed) {
    return (
      <LoadErrorState
        title="Could not load notes"
        message={notesQuery.data?.error}
        onRetry={() => notesQuery.refetch()}
        isRetrying={notesQuery.isFetching}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Compose Area */}
      <div className="space-y-2 rounded-lg border border-border bg-muted/30 p-3 sm:p-4">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              handleCreate();
            }
          }}
          placeholder="Write a note about this customer..."
          rows={3}
          maxLength={MAX_NOTE}
          className="resize-none bg-card"
        />
        <div className="flex items-center justify-between">
          <p className="font-body text-xs text-muted-foreground">Ctrl+Enter to add quickly</p>
          <Button
            onClick={handleCreate}
            disabled={!newNote.trim() || createMutation.isPending}
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {createMutation.isPending ? "Adding..." : "Add Note"}
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
          <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand-light">
            <IconNote className="h-5 w-5 text-brand" />
          </div>
          <p className="font-body text-sm font-medium text-foreground">No notes yet</p>
          <p className="mt-1 text-xs text-muted-foreground">Add your first note above</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => {
            const edited = note.updatedAt && note.updatedAt !== note.createdAt;
            return (
              <div
                key={note.id}
                className="space-y-2 rounded-lg border border-border/70 bg-surface p-3 transition-colors hover:border-border sm:p-4"
              >
                {editingId === note.id ? (
                  <>
                    <Textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={3}
                      maxLength={MAX_NOTE}
                      className="resize-none"
                    />
                    <div className="flex justify-end gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>
                        <IconX className="h-4 w-4" />
                        <span className="sr-only">Cancel</span>
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleUpdate(note.id)}
                        disabled={updateMutation.isPending || !editContent.trim()}
                        className="bg-brand text-brand-foreground hover:bg-brand/90"
                      >
                        <IconCheck className="h-4 w-4" />
                        <span className="sr-only">Save</span>
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="whitespace-pre-wrap font-body text-sm text-foreground">
                      {note.content}
                    </p>
                    <div className="flex items-center justify-between border-t border-border/40 pt-2.5">
                      <p className="text-xs text-muted-foreground">
                        {authorLabel(note)} &middot;{" "}
                        {new Date(note.createdAt).toLocaleDateString()}{" "}
                        {new Date(note.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                        {/* An edited note used to show only its original time,
                            with no sign it had been rewritten. */}
                        {edited && <span className="ml-1 italic">(edited)</span>}
                      </p>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => {
                            setEditingId(note.id);
                            setEditContent(note.content);
                          }}
                        >
                          <IconEdit className="h-3.5 w-3.5" />
                          <span className="sr-only">Edit note</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          // Used to delete on the first click, with no
                          // confirmation and no undo — the only destructive
                          // action on the platform that did (CUST-21).
                          onClick={() => setDeletingNote(note)}
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                          <span className="sr-only">Delete note</span>
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <Pagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          onPageChange={setPage}
          entityName="note"
        />
      )}

      <DeleteConfirmDialog
        entityName="Note"
        itemLabel={
          deletingNote
            ? `“${deletingNote.content.slice(0, 60)}${deletingNote.content.length > 60 ? "…" : ""}”`
            : ""
        }
        open={!!deletingNote}
        onOpenChange={(open) => { if (!open) setDeletingNote(null); }}
        onConfirm={handleDelete}
        loading={deleteMutation.isPending}
        description="This note will be removed from the customer's history."
      />
    </div>
  );
}
