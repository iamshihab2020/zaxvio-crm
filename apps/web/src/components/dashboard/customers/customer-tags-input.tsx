"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconPlus, IconX, IconCheck } from "@tabler/icons-react";
import { toast } from "sonner";
import { getTags, createTag } from "@/actions/tags";
import { useAddCustomerTag, useRemoveCustomerTag } from "@/hooks/queries";

interface TagData {
  id: string;
  name: string;
  color: string | null;
}

interface CustomerTagsInputProps {
  customerId: string;
  assignedTags: TagData[];
}

const TAG_COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#6b7280",
];

export function CustomerTagsInput({
  customerId,
  assignedTags,
}: CustomerTagsInputProps) {
  const [open, setOpen] = useState(false);
  const [allTags, setAllTags] = useState<TagData[]>([]);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);
  const [fetchError, setFetchError] = useState(false);

  // The mutations own cache invalidation and error toasts, so a failed assign no
  // longer looks identical to a successful one (CUST-10, CUST-22).
  const addTag = useAddCustomerTag(customerId);
  const removeTag = useRemoveCustomerTag(customerId);

  useEffect(() => {
    if (open) {
      setFetchError(false);
      getTags().then((res) => {
        if (res.data) {
          setAllTags(res.data);
        } else {
          setFetchError(true);
        }
      });
    }
  }, [open]);

  const assignedIds = new Set(assignedTags.map((t) => t.id));

  // All tags matching the search (including assigned ones, for display)
  const matchingTags = allTags.filter((t) =>
    t.name.toLowerCase().includes(search.toLowerCase()),
  );

  // Only unassigned tags matching the search (for adding)
  const unassignedTags = matchingTags.filter((t) => !assignedIds.has(t.id));

  const showCreateOption =
    search.trim() &&
    !allTags.some(
      (t) => t.name.toLowerCase() === search.trim().toLowerCase(),
    );

  function handleAssignTag(tag: TagData) {
    addTag.mutate(tag.id);
  }

  function handleRemoveTag(tagId: string) {
    removeTag.mutate(tagId);
  }

  async function handleCreateAndAssign() {
    if (!search.trim() || creating) return;
    setCreating(true);
    const color = TAG_COLORS[Math.floor(Math.random() * TAG_COLORS.length)];
    const res = await createTag(search.trim(), color);
    if (res.data) {
      const newTag: TagData = {
        id: res.data.id,
        name: res.data.name,
        color: res.data.color,
      };
      setAllTags((prev) => [...prev, newTag]);
      handleAssignTag(newTag);
      setSearch("");
    } else {
      // Creating the tag could fail and the only sign was that nothing happened.
      toast.error(res.error ?? "Could not create that tag");
    }
    setCreating(false);
  }

  // Determine the empty-state message
  function getEmptyMessage() {
    if (fetchError) return "Could not load tags";
    if (allTags.length === 0) return "No tags yet — type to create one";
    if (search.trim() && matchingTags.length === 0) return "No matching tags";
    if (unassignedTags.length === 0 && matchingTags.length > 0) return "All tags assigned to this customer";
    return "Type to search or create a tag";
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {assignedTags.map((tag) => (
          <Badge
            key={tag.id}
            variant="secondary"
            className="gap-1 pr-1 text-xs font-medium"
            style={
              tag.color
                ? {
                    backgroundColor: `${tag.color}20`,
                    color: tag.color,
                  }
                : undefined
            }
          >
            <span
              className="h-1.5 w-1.5 rounded-full shrink-0"
              style={tag.color ? { backgroundColor: tag.color } : undefined}
            />
            {tag.name}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => handleRemoveTag(tag.id)}
              className="ml-0.5 h-4 w-4 rounded-full hover:bg-black/10 dark:hover:bg-white/10"
            >
              <IconX className="h-2.5 w-2.5" />
            </Button>
          </Badge>
        ))}
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-6 gap-1 px-2 text-xs text-muted-foreground"
            >
              <IconPlus className="h-3 w-3" />
              Add Tag
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-56 p-2" align="start">
            <Input
              placeholder="Search or create..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="mb-2 h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && showCreateOption) {
                  e.preventDefault();
                  handleCreateAndAssign();
                }
              }}
            />
            <div className="max-h-40 overflow-y-auto space-y-0.5">
              {/* Unassigned tags — clickable to assign */}
              {unassignedTags.map((tag) => (
                <Button
                  key={tag.id}
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => handleAssignTag(tag)}
                  className="w-full justify-start gap-2"
                >
                  {tag.color && (
                    <span
                      className="h-2.5 w-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  {tag.name}
                </Button>
              ))}

              {/* Already-assigned tags — shown grayed with checkmark */}
              {matchingTags
                .filter((t) => assignedIds.has(t.id))
                .map((tag) => (
                  <div
                    key={tag.id}
                    className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground"
                  >
                    {tag.color && (
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0 opacity-40"
                        style={{ backgroundColor: tag.color }}
                      />
                    )}
                    <span className="flex-1">{tag.name}</span>
                    <IconCheck className="h-3.5 w-3.5 text-brand" />
                  </div>
                ))}

              {showCreateOption && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleCreateAndAssign}
                  disabled={creating}
                  className="w-full justify-start gap-2 text-brand"
                >
                  <IconPlus className="h-3.5 w-3.5" />
                  Create &quot;{search.trim()}&quot;
                </Button>
              )}

              {matchingTags.length === 0 && !showCreateOption && (
                <p className="px-2 py-1.5 text-xs text-muted-foreground">
                  {getEmptyMessage()}
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}
