"use client";

import { useState, useCallback } from "react";
import type { Customer } from "@hvac-saas/types";
import { CustomerDetailHeader } from "@/components/dashboard/customers/customer-detail-header";
import { CustomerInfoPanel } from "@/components/dashboard/customers/customer-info-panel";
import { CustomerTabsPanel } from "@/components/dashboard/customers/customer-tabs-panel";
import { CustomerSidebarPanel } from "@/components/dashboard/customers/customer-sidebar-panel";

interface CustomerDetailClientProps {
  customer: Customer;
}

export function CustomerDetailClient({
  customer: initialCustomer,
}: CustomerDetailClientProps) {
  const [customer, setCustomer] = useState(initialCustomer);
  const [activityKey, setActivityKey] = useState(0);

  const handleCustomerUpdate = useCallback((updated: Customer) => {
    setCustomer(updated);
    setActivityKey((k) => k + 1);
  }, []);

  return (
    <div className="flex flex-col h-full bg-surface">
      <CustomerDetailHeader customer={customer} />
      <div className="flex-1 overflow-y-auto p-4 sm:p-6">
        <div className="flex flex-col lg:flex-row gap-4 sm:gap-5">
          {/* Left Panel */}
          <div className="w-full lg:w-80 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <CustomerInfoPanel customer={customer} onUpdate={handleCustomerUpdate} />
          </div>
          {/* Center Panel */}
          <div className="flex-1 min-w-0 rounded-lg border border-border bg-card shadow-sm p-4 sm:p-5">
            <CustomerTabsPanel customerId={customer.id} activityKey={activityKey} />
          </div>
          {/* Right Sidebar */}
          <div className="hidden xl:block w-72 shrink-0 rounded-lg border border-border bg-card shadow-sm">
            <CustomerSidebarPanel />
          </div>
        </div>
      </div>
    </div>
  );
}
