"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Sheet,
  SheetContent,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  IconDots,
  IconTrash,
  IconLayoutSidebar,
  IconMaximize,
  IconExternalLink,
  IconX,
} from "@tabler/icons-react";
import { InvoiceStatusBadge } from "./invoice-status-badge";
import { InvoiceDetailTab } from "./invoice-detail-tab";
import { InvoiceLineItemsTab } from "./invoice-line-items-tab";
import { InvoicePaymentsTab } from "./invoice-payments-tab";
import {
  getInvoice,
  sendInvoice,
  getInvoicePdfUrl,
  voidInvoice,
} from "@/actions/invoices";

export interface InvoiceDetail {
  id: string;
  invoiceNumber: string;
  status: string;
  issuedDate: string;
  dueDate: string | null;
  subtotal: string;
  taxRate: string | null;
  taxAmount: string | null;
  discountAmount: string | null;
  totalAmount: string;
  amountPaid: string;
  balanceDue: string;
  notes: string | null;
  pdfStoragePath: string | null;
  customerId: string;
  jobId: string | null;
  customerFirstName: string | null;
  customerLastName: string | null;
  customerEmail: string | null;
  customerPhone: string | null;
  customerAddress: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: Array<{
    id: string;
    itemType: string;
    description: string;
    quantity: string;
    unitPrice: string;
    total: string | null;
    catalogItemId: string | null;
    sortOrder: number | null;
  }>;
  payments: Array<{
    id: string;
    amount: string;
    paymentMethod: string | null;
    paymentDate: string;
    referenceNumber: string | null;
    notes: string | null;
    createdAt: string;
  }>;
}

interface InvoiceDetailSheetProps {
  invoiceId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDelete: (invoice: InvoiceDetail) => void;
  onDataChange: () => void;
}

import { useViewPreference } from "@/hooks/use-view-preference";

const DEFAULT_WIDTH = 520;
const MIN_WIDTH = 400;
const MAX_WIDTH = 800;

/* ── Tab definitions ─────────────────────────────────────────── */

const TAB_VALUES = ["details", "line-items", "payments"] as const;

export function InvoiceDetailSheet({
  invoiceId,
  open,
  onOpenChange,
  onDelete,
  onDataChange,
}: InvoiceDetailSheetProps) {
  const router = useRouter();
  const [invoice, setInvoice] = useState<InvoiceDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("details");
  const [sendLoading, setSendLoading] = useState(false);

  /* ── Preferences ──────────────────────────────────────────── */
  const { mode: prefMode, sidebarWidth: prefSidebarWidth, mounted, setMode: setPrefMode, setSidebarWidth: setPrefSidebarWidth } = useViewPreference("invoices");
  const [liveSidebarWidth, setLiveSidebarWidth] = useState(DEFAULT_WIDTH);
  const switchingModeRef = useRef(false);

  useEffect(() => {
    setLiveSidebarWidth(prefSidebarWidth);
  }, [prefSidebarWidth]);

  /* ── Invoice data fetching ──────────────────────────────────── */
  useEffect(() => {
    if (!invoiceId || !open) {
      setInvoice(null);
      return;
    }
    setLoading(true);
    setActiveTab("details");
    getInvoice(invoiceId).then((res) => {
      if (res.data) setInvoice(res.data as InvoiceDetail);
      setLoading(false);
    });
  }, [invoiceId, open]);

  async function refreshDetail() {
    if (!invoiceId) return;
    const res = await getInvoice(invoiceId);
    if (res.data) setInvoice(res.data as InvoiceDetail);
  }

  async function handleSend() {
    if (!invoice) return;
    setSendLoading(true);
    const result = await sendInvoice(invoice.id);
    setSendLoading(false);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice sent successfully");
      refreshDetail();
      onDataChange();
    }
  }

  async function handleDownloadPdf() {
    if (!invoice) return;
    const url = await getInvoicePdfUrl(invoice.id);
    window.open(url, "_blank");
  }

  async function handleVoid() {
    if (!invoice) return;
    const result = await voidInvoice(invoice.id);
    if (result.error) {
      toast.error(result.error);
    } else {
      toast.success("Invoice voided");
      refreshDetail();
      onDataChange();
    }
  }

  /* ── Mode toggle ──────────────────────────────────────────── */
  function toggleMode() {
    switchingModeRef.current = true;
    const newMode = prefMode === "sidebar" ? "dialog" : "sidebar";
    setPrefMode(newMode);
    setIndicatorReady(false);
    requestAnimationFrame(() => {
      switchingModeRef.current = false;
    });
  }

  function handleOpenChange(newOpen: boolean) {
    if (switchingModeRef.current) return;
    onOpenChange(newOpen);
  }

  /* ── Drag-to-resize (sidebar only) ────────────────────────── */
  const dragWidthRef = useRef(DEFAULT_WIDTH);

  const handleDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragWidthRef.current = liveSidebarWidth;

      const onMove = (ev: MouseEvent) => {
        const w = Math.max(
          MIN_WIDTH,
          Math.min(MAX_WIDTH, window.innerWidth - ev.clientX),
        );
        dragWidthRef.current = w;
        setLiveSidebarWidth(w);
      };

      const onUp = () => {
        document.removeEventListener("mousemove", onMove);
        document.removeEventListener("mouseup", onUp);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        setPrefSidebarWidth(dragWidthRef.current);
      };

      document.addEventListener("mousemove", onMove);
      document.addEventListener("mouseup", onUp);
      document.body.style.cursor = "col-resize";
      document.body.style.userSelect = "none";
    },
    [liveSidebarWidth],
  );

  /* ── Sliding tab indicator ────────────────────────────────── */
  const navRef = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [indicator, setIndicator] = useState({ left: 0, width: 0 });
  const [indicatorReady, setIndicatorReady] = useState(false);

  const activeTabIndex = TAB_VALUES.indexOf(
    activeTab as (typeof TAB_VALUES)[number],
  );
  const targetIndex = hoveredIndex ?? activeTabIndex;

  const updateIndicatorTo = useCallback(
    (index: number) => {
      const el = tabRefs.current[index];
      const navEl = navRef.current;
      if (el && navEl) {
        const navRect = navEl.getBoundingClientRect();
        const tabRect = el.getBoundingClientRect();
        setIndicator({
          left: tabRect.left - navRect.left + navEl.scrollLeft,
          width: tabRect.width,
        });
        if (!indicatorReady) setIndicatorReady(true);
      }
    },
    [indicatorReady],
  );

  // Recalculate indicator on target change or mode switch
  useEffect(() => {
    if (targetIndex >= 0 && !loading && invoice) {
      const id = requestAnimationFrame(() => updateIndicatorTo(targetIndex));
      return () => cancelAnimationFrame(id);
    }
  }, [targetIndex, updateIndicatorTo, loading, invoice, prefMode]);

  // Recalculate on window resize
  useEffect(() => {
    const onResize = () => {
      if (targetIndex >= 0) updateIndicatorTo(targetIndex);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [targetIndex, updateIndicatorTo]);

  /* ── Tab labels with counts ────────────────────────────────── */
  function tabLabel(value: string): string {
    if (!invoice) return value;
    switch (value) {
      case "details":
        return "Details";
      case "line-items":
        return `Line Items (${invoice.lineItems.length})`;
      case "payments":
        return `Payments (${invoice.payments.length})`;
      default:
        return value;
    }
  }

  const mode = mounted ? (prefMode === "page" ? "sidebar" : prefMode) : "sidebar";

  /* ── Shared inner content ─────────────────────────────────── */
  const innerContent = (
    <>
      {loading && (
        <>
          <SheetTitle className="sr-only">Invoice details</SheetTitle>
          <SheetDescription className="sr-only">
            Loading invoice information
          </SheetDescription>
          <div className="p-6 space-y-4">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-4 w-48" />
            <div className="space-y-3 pt-4">
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </div>
          </div>
        </>
      )}

      {!loading && invoice && (
        <>
          {/* ── Header ────────────────────────────────────── */}
          <div className="px-6 pt-6 pb-4 border-b border-border">
            <div className="flex items-start justify-between pr-8">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <SheetTitle className="font-heading text-lg">
                    {invoice.invoiceNumber}
                  </SheetTitle>
                  <InvoiceStatusBadge status={invoice.status} />
                </div>
                <SheetDescription className="text-sm font-body">
                  {invoice.customerFirstName} {invoice.customerLastName}
                  {invoice.jobId && " · From Job"}
                </SheetDescription>
              </div>

              <div className="flex items-center gap-1">
                {/* Mode toggle */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={toggleMode}
                  title={
                    mode === "sidebar"
                      ? "Switch to dialog view"
                      : "Switch to sidebar view"
                  }
                >
                  {mode === "sidebar" ? (
                    <IconMaximize className="h-4 w-4" />
                  ) : (
                    <IconLayoutSidebar className="h-4 w-4" />
                  )}
                </Button>

                {/* Open full page */}
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => {
                    setPrefMode("page");
                    onOpenChange(false);
                    router.push(`/invoices/${invoice.id}`);
                  }}
                  title="Open full page"
                >
                  <IconExternalLink className="h-4 w-4" />
                </Button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 cursor-pointer"
                    >
                      <IconDots className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onClick={() => onDelete(invoice)}
                      className="cursor-pointer text-destructive focus:text-destructive"
                    >
                      <IconTrash className="mr-2 h-4 w-4" />
                      Delete Invoice
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 cursor-pointer"
                  onClick={() => onOpenChange(false)}
                  title="Close"
                >
                  <IconX className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>

          {/* ── Tabs with sliding indicator ───────────────── */}
          <Tabs
            value={activeTab}
            onValueChange={setActiveTab}
            className="flex-1"
          >
            <TabsList
              ref={navRef}
              className="relative w-full justify-start rounded-none border-b border-border bg-transparent px-6 pt-2"
              onMouseLeave={() => setHoveredIndex(null)}
            >
              {/* Sliding indicator */}
              <div
                className={cn(
                  "absolute bottom-0 h-[2px] bg-brand",
                  indicatorReady
                    ? "transition-all duration-300 ease-in-out"
                    : "",
                )}
                style={{ left: indicator.left, width: indicator.width }}
              />
              {TAB_VALUES.map((value, i) => (
                <TabsTrigger
                  key={value}
                  value={value}
                  ref={(el) => {
                    tabRefs.current[i] = el;
                  }}
                  onMouseEnter={() => setHoveredIndex(i)}
                  className="cursor-pointer border-b-0 data-[state=active]:border-transparent"
                >
                  {tabLabel(value)}
                </TabsTrigger>
              ))}
            </TabsList>

            <div className="px-6 py-4">
              <TabsContent value="details" className="mt-0">
                <InvoiceDetailTab
                  invoice={invoice}
                  onSend={handleSend}
                  onDownloadPdf={handleDownloadPdf}
                  onVoid={handleVoid}
                  sendLoading={sendLoading}
                />
              </TabsContent>
              <TabsContent value="line-items" className="mt-0">
                <InvoiceLineItemsTab
                  invoiceId={invoice.id}
                  lineItems={invoice.lineItems}
                  isDraft={invoice.status === "draft"}
                  onUpdate={() => {
                    refreshDetail();
                    onDataChange();
                  }}
                />
              </TabsContent>
              <TabsContent value="payments" className="mt-0">
                <InvoicePaymentsTab
                  invoiceId={invoice.id}
                  payments={invoice.payments}
                  balanceDue={invoice.balanceDue}
                  isVoid={invoice.status === "void"}
                  onUpdate={() => {
                    refreshDetail();
                    onDataChange();
                  }}
                />
              </TabsContent>
            </div>
          </Tabs>
        </>
      )}
    </>
  );

  /* ── Render: Dialog mode ──────────────────────────────────── */
  if (mode === "dialog") {
    return (
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto p-0">
          {innerContent}
        </DialogContent>
      </Dialog>
    );
  }

  /* ── Render: Sidebar mode (default) ───────────────────────── */
  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="right"
        className="overflow-y-auto p-0"
        style={{
          maxWidth: mounted ? liveSidebarWidth : DEFAULT_WIDTH,
          width: "100%",
        }}
      >
        {/* Drag handle — left edge resize */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 group"
          onMouseDown={handleDragStart}
        >
          <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-transparent group-hover:bg-brand/40 transition-colors" />
        </div>
        {innerContent}
      </SheetContent>
    </Sheet>
  );
}
