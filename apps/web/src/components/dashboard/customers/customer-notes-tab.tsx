"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  getCustomerNotes,
  createCustomerNote,
  updateCustomerNote,
  deleteCustomerNote,
} from "@/actions/customers";
import { IconNote, IconEdit, IconTrash, IconCheck, IconX } from "@tabler/icons-react";

interface Note {
  id: string;
  content: string;
  createdBy: string;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
}

interface CustomerNotesTabProps {
  customerId: string;
}

export function CustomerNotesTab({ customerId }: CustomerNotesTabProps) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  useEffect(() => {
    loadNotes();
  }, [customerId]);

  async function loadNotes() {
    const res = await getCustomerNotes(customerId, { limit: 50 });
    if (res.data) setNotes(res.data);
    setLoading(false);
  }

  async function handleCreate() {
    if (!newNote.trim() || saving) return;
    setSaving(true);
    const res = await createCustomerNote(customerId, newNote.trim());
    if (res.data) {
      setNewNote("");
      await loadNotes();
    }
    setSaving(false);
  }

  async function handleUpdate(noteId: string) {
    if (!editContent.trim()) return;
    const res = await updateCustomerNote(customerId, noteId, editContent.trim());
    if (res.data) {
      setNotes((prev) =>
        prev.map((n) =>
          n.id === noteId ? { ...n, content: res.data.content, updatedAt: res.data.updatedAt } : n,
        ),
      );
      setEditingId(null);
    }
  }

  async function handleDelete(noteId: string) {
    const res = await deleteCustomerNote(customerId, noteId);
    if (!res.error) {
      setNotes((prev) => prev.filter((n) => n.id !== noteId));
    }
  }

  if (loading) {
    return (
      <div className="space-y-4 py-2">
        <Skeleton className="h-20 w-full" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-24 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Compose Area */}
      <div className="rounded-lg border border-border bg-muted/30 p-3 sm:p-4 space-y-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Write a note about this customer..."
          rows={3}
          className="resize-none bg-card"
        />
        <div className="flex justify-end">
          <Button
            onClick={handleCreate}
            disabled={!newNote.trim() || saving}
            size="sm"
            className="bg-brand text-brand-foreground hover:bg-brand/90"
          >
            {saving ? "Adding..." : "Add Note"}
          </Button>
        </div>
      </div>

      {/* Notes List */}
      {notes.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-12 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
            <IconNote className="h-5 w-5 text-brand" />
          </div>
          <p className="text-sm font-medium text-foreground font-body">
            No notes yet
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Add your first note above
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {notes.map((note) => (
            <div
              key={note.id}
              className="rounded-lg border border-border/70 bg-surface p-3 sm:p-4 space-y-2 hover:border-border transition-colors"
            >
              {editingId === note.id ? (
                <>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    rows={3}
                    className="resize-none"
                  />
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setEditingId(null)}
                    >
                      <IconX className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleUpdate(note.id)}
                      className="bg-brand text-brand-foreground hover:bg-brand/90"
                    >
                      <IconCheck className="h-4 w-4" />
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <p className="text-sm text-foreground font-body whitespace-pre-wrap">
                    {note.content}
                  </p>
                  <div className="flex items-center justify-between pt-2.5 border-t border-border/40">
                    <p className="text-xs text-muted-foreground">
                      {note.authorName ?? "Unknown"} &middot;{" "}
                      {new Date(note.createdAt).toLocaleDateString()}{" "}
                      {new Date(note.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
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
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => handleDelete(note.id)}
                      >
                        <IconTrash className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
