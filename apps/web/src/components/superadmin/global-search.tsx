"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { IconBuilding, IconSearch } from "@tabler/icons-react";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { adminSearch } from "@/actions/admin";

interface TenantResult {
  id: string;
  businessName: string;
  ownerName: string;
  email: string;
  isActive: boolean | null;
  subscriptionStatus: string | null;
  planName: string | null;
}

export function GlobalSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TenantResult[]>([]);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  // Cmd+K to open
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  const search = useCallback(async (q: string) => {
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const result = await adminSearch(q);
    if (result.data?.tenants) {
      setResults(result.data.tenants);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300);
    return () => clearTimeout(timer);
  }, [query, search]);

  const handleSelect = (tenantId: string) => {
    setOpen(false);
    setQuery("");
    setResults([]);
    router.push(`/superadmin/tenants/${tenantId}`);
  };

  return (
    <>
      {/* A 40px icon button on phones, where the label is hidden and the
          navbar has no room for a field; it opens the same dialog. The
          `aria-label` is what names it while the text is hidden. */}
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        aria-label="Search tenants"
        className="flex h-10 w-10 items-center gap-2 px-0 text-sm text-muted-foreground hover:bg-muted/50 sm:h-9 sm:w-auto sm:px-3"
      >
        <IconSearch className="h-4 w-4" />
        <span className="hidden sm:inline font-body">Search tenants...</span>
        <kbd className="hidden sm:inline-flex h-5 items-center gap-1 rounded border border-border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="overflow-hidden p-0 sm:max-w-lg">
          <Command className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted-foreground">
            <CommandInput
              placeholder="Search tenants by name, email, or slug..."
              value={query}
              onValueChange={setQuery}
              className="font-body"
            />
            <CommandList className="max-h-[300px]">
              {loading && (
                <div className="py-6 text-center text-sm text-muted-foreground font-body">
                  Searching...
                </div>
              )}
              {!loading && query.length >= 2 && results.length === 0 && (
                <CommandEmpty className="motion-appear font-body">No tenants found.</CommandEmpty>
              )}
              {!loading && results.length > 0 && (
                <CommandGroup heading="Tenants" className="motion-appear">
                  {results.map((tenant) => (
                    <CommandItem
                      key={tenant.id}
                      value={`${tenant.businessName} ${tenant.ownerName} ${tenant.email}`}
                      onSelect={() => handleSelect(tenant.id)}
                      className="cursor-pointer"
                    >
                      <IconBuilding className="mr-2 h-4 w-4 shrink-0 text-muted-foreground" />
                      {/* `min-w-0` + `truncate`: the list clips sideways
                          overflow, so a long address would hide the status
                          badge instead of shortening. */}
                      <div className="flex min-w-0 flex-1 items-center justify-between">
                        <div className="min-w-0">
                          <p className="truncate font-body text-sm font-medium">
                            {tenant.businessName}
                          </p>
                          <p className="truncate font-body text-xs text-muted-foreground">
                            {tenant.ownerName} · {tenant.email}
                          </p>
                        </div>
                        <Badge
                          variant="outline"
                          className="ml-2 shrink-0 text-xs font-body capitalize"
                        >
                          {tenant.subscriptionStatus ?? "unknown"}
                        </Badge>
                      </div>
                    </CommandItem>
                  ))}
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </DialogContent>
      </Dialog>
    </>
  );
}
