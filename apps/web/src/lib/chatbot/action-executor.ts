"use server";

import type { PendingAction, CustomerSearchResult } from "./types";
import { createCustomer, getCustomers } from "@/actions/customers";
import { createCalendarEvent } from "@/actions/calendar-events";
import { createJob } from "@/actions/jobs";
import { createInvoice } from "@/actions/invoices";
import { createQuote } from "@/actions/quotes";
import { createCatalogItem } from "@/actions/catalog";
import { createEquipment } from "@/actions/equipment";

interface ExecuteResult {
  success: boolean;
  error?: string;
  entityName?: string;
}

/** Execute a confirmed action by calling the appropriate server action */
export async function executeAction(
  action: PendingAction,
): Promise<ExecuteResult> {
  const { type, params } = action;

  try {
    switch (type) {
      case "create_customer": {
        const result = await createCustomer({
          firstName: params.firstName ?? "",
          lastName: params.lastName ?? "",
          email: params.email,
          phone: params.phone,
          address: params.address,
          city: params.city,
          state: params.state,
          zipCode: params.zipCode,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Customer" };
        return { success: true, entityName: "Customer" };
      }

      case "create_event": {
        const result = await createCalendarEvent({
          title: params.title ?? "",
          eventDate: params.eventDate ?? "",
          startTime: params.startTime,
          endTime: params.endTime,
          description: params.description,
          contactName: params.contactName,
          contactPhone: params.contactPhone,
          address: params.address,
          color: params.color,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Calendar Event" };
        return { success: true, entityName: "Calendar Event" };
      }

      case "create_job": {
        const result = await createJob({
          customerId: params.customerId ?? "",
          serviceType: params.serviceType ?? "general",
          title: params.title ?? "New Job",
          scheduledDate: params.scheduledDate ?? "",
          description: params.description,
          scheduledStart: params.scheduledStart,
          scheduledEnd: params.scheduledEnd,
          address: params.address,
          priority: params.priority,
          notes: params.notes,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Job" };
        return { success: true, entityName: "Job" };
      }

      case "create_invoice": {
        const result = await createInvoice({
          customerId: params.customerId ?? "",
          dueDate: params.dueDate,
          taxRate: params.taxRate,
          discountAmount: params.discountAmount,
          notes: params.notes,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Invoice" };
        return { success: true, entityName: "Invoice" };
      }

      case "create_quote": {
        const result = await createQuote({
          customerId: params.customerId ?? "",
          expiryDate: params.expiryDate,
          taxRate: params.taxRate,
          discountAmount: params.discountAmount,
          notes: params.notes,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Quote" };
        return { success: true, entityName: "Quote" };
      }

      case "create_catalog_item": {
        const result = await createCatalogItem({
          name: params.name ?? "",
          itemType: params.itemType ?? "parts",
          unitPrice: parseFloat(params.unitPrice ?? "0"),
          unit: params.unit,
          category: params.category,
          description: params.description,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Catalog Item" };
        return { success: true, entityName: "Catalog Item" };
      }

      case "create_equipment": {
        const result = await createEquipment({
          customerId: params.customerId ?? "",
          equipmentType: params.equipmentType ?? "",
          brand: params.brand,
          model: params.model,
          serialNumber: params.serialNumber,
          installDate: params.installDate,
          warrantyExpiry: params.warrantyExpiry,
          location: params.location,
          notes: params.notes,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Equipment" };
        return { success: true, entityName: "Equipment" };
      }

      case "create_booking": {
        // For chatbot, create as a calendar event with booking info
        const result = await createCalendarEvent({
          title: `Booking: ${params.serviceType ?? "Service"} - ${params.customerName ?? "Customer"}`,
          eventDate: params.bookingDate ?? "",
          startTime: params.preferredTime,
          contactName: params.customerName,
          contactPhone: params.customerPhone,
          description: params.description,
          address: params.address,
        });
        if (result.error) return { success: false, error: result.error, entityName: "Booking" };
        return { success: true, entityName: "Booking" };
      }

      default:
        return { success: false, error: "Unknown action type" };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : "An unexpected error occurred";
    return { success: false, error: message };
  }
}

/** Search customers by name for customer lookup flow */
export async function searchCustomersForChatbot(
  query: string,
): Promise<{ customers: CustomerSearchResult[]; error?: string }> {
  try {
    const result = await getCustomers({ search: query, limit: 5 });
    if (result.error) {
      return { customers: [], error: result.error };
    }

    interface CustomerData {
      id: string;
      firstName: string;
      lastName: string;
      email: string | null;
      phone: string | null;
    }

    const customers: CustomerSearchResult[] = ((result.data ?? []) as CustomerData[]).map(
      (c) => ({
        id: c.id,
        firstName: c.firstName,
        lastName: c.lastName,
        email: c.email ?? null,
        phone: c.phone ?? null,
      }),
    );

    return { customers };
  } catch {
    return { customers: [], error: "Failed to search customers" };
  }
}
