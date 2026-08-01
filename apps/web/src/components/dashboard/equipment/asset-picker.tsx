"use client";

import { useState, useEffect, useCallback } from "react";
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
import { getEquipment } from "@/actions/equipment";

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
  const [assets, setAssets] = useState<AssetOption[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchAssets = useCallback(async () => {
    if (!customerId) {
      setAssets([]);
      return;
    }
    setLoading(true);
    const result = await getEquipment({ customerId, limit: 100 });
    if (result.data) {
      setAssets(result.data as AssetOption[]);
    }
    setLoading(false);
  }, [customerId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

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
