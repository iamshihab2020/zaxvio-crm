"use client";

import { useState, useEffect } from "react";
import { useEquipment } from "@/hooks/queries";
import { IconDevices2, IconCheck, IconSelector } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandItem,
  CommandEmpty,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

interface AssetPickerProps {
  customerId: string | null;
  value: string | null;
  onChange: (equipmentId: string | null) => void;
  disabled?: boolean;
}

interface AssetOption {
  id: string;
  equipmentType: string;
  brand: string | null;
  model: string | null;
  serialNumber: string | null;
}

export function AssetPicker({
  customerId,
  value,
  onChange,
  disabled,
}: AssetPickerProps) {
  const [open, setOpen] = useState(false);

  /**
   * Fetches when the popover opens, not when the dialog mounts.
   *
   * This used to call a bare server action from a mount effect, so simply
   * opening Create Quote spent a Next → Fastify → Neon round trip on a dropdown
   * the user may never touch. Next.js queues server actions, so that trip sat
   * in front of the picker they *did* open — which is what made opening a
   * selection feel slow. There was no cache either, so every re-open of the
   * dialog paid for it again.
   *
   * `useEquipment` has existed with a 30s cache the whole time and this
   * component never called it.
   */
  // `|| !!value` so a picker that already has a selection can still resolve its
  // label without being opened — otherwise an edit surface would render
  // "Select asset..." over a real selection.
  const assetsQuery = useEquipment(
    { customerId: customerId ?? undefined, limit: 100 },
    { enabled: (open || !!value) && !!customerId },
  );

  const assets = (assetsQuery.data?.data ?? []) as AssetOption[];
  const loading = assetsQuery.isPending && open && !!customerId;

  // Reset value if customer changes
  useEffect(() => {
    if (!customerId && value) {
      onChange(null);
    }
  }, [customerId, value, onChange]);

  const selectedAsset = assets.find((a) => a.id === value);
  const displayLabel = selectedAsset
    ? [
        selectedAsset.equipmentType,
        selectedAsset.brand,
        selectedAsset.model,
      ]
        .filter(Boolean)
        .join(" — ")
    : !customerId
      ? "Select a customer first"
      : "Select asset...";

  /**
   * `modal` on the Popover, because this picker opens inside the Create Job and
   * Create Quote dialogs.
   *
   * A Radix Dialog mounts react-remove-scroll with its own content as the only
   * scrollable shard, and a Popover renders in a portal *outside* that subtree.
   * The wheel event over this list was therefore swallowed and the results
   * would not scroll — with a visible scrollbar sitting right there, which made
   * it read as a broken list rather than a locked one. A modal Popover
   * registers its own content as a shard, which re-permits the wheel.
   */
  return (
    <Popover modal open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled || !customerId}
          className={cn(
            "w-full justify-between font-normal",
            !value && "text-muted-foreground",
          )}
        >
          <span className="flex items-center gap-2 truncate">
            <IconDevices2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{displayLabel}</span>
          </span>
          <IconSelector className="h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[300px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search assets..." />
          <CommandList>
            {loading ? (
              <div className="p-4 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <CommandEmpty>
                  No assets found for this customer.
                </CommandEmpty>
                {value && (
                  <CommandItem
                    onSelect={() => {
                      onChange(null);
                      setOpen(false);
                    }}
                  >
                    <span className="text-muted-foreground">
                      Clear selection
                    </span>
                  </CommandItem>
                )}
                {assets.map((asset) => (
                  <CommandItem
                    key={asset.id}
                    value={[
                      asset.equipmentType,
                      asset.brand,
                      asset.model,
                      asset.serialNumber,
                    ]
                      .filter(Boolean)
                      .join(" ")}
                    onSelect={() => {
                      onChange(asset.id);
                      setOpen(false);
                    }}
                  >
                    <IconCheck
                      className={cn(
                        "mr-2 h-4 w-4",
                        value === asset.id ? "opacity-100" : "opacity-0",
                      )}
                    />
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {asset.equipmentType}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {[asset.brand, asset.model]
                          .filter(Boolean)
                          .join(" ") || "No brand/model"}
                        {asset.serialNumber
                          ? ` — S/N: ${asset.serialNumber}`
                          : ""}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
