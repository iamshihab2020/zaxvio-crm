"use server";

import { cookies } from "next/headers";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

async function getCookieHeader() {
  const cookieStore = await cookies();
  return cookieStore
    .getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
}

// ===== INVOICE STATS =====

export async function getInvoiceStats() {
  try {
    const res = await fetch(`${API_URL}/invoices/stats`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });
    if (!res.ok) return { data: null, error: "Failed to load stats" };
    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== INVOICES CRUD =====

export async function getInvoices(params?: {
  search?: string;
  status?: string;
  customerId?: string;
  jobId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
  showArchived?: boolean;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    if (params?.jobId) searchParams.set("jobId", params.jobId);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);
    if (params?.showArchived) searchParams.set("showArchived", "true");

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/invoices${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch invoices" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getInvoice(id: string) {
  try {
    const res = await fetch(`${API_URL}/invoices/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Invoice not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createInvoice(data: {
  customerId: string;
  jobId?: string;
  issuedDate?: string;
  dueDate?: string;
  taxRate?: string;
  discountAmount?: string;
  notes?: string;
}) {
  try {
    const res = await fetch(`${API_URL}/invoices`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to create invoice" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createInvoiceFromJob(jobId: string) {
  try {
    const res = await fetch(`${API_URL}/invoices/from-job/${jobId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to create invoice from job",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateInvoice(
  id: string,
  data: {
    notes?: string;
    dueDate?: string;
    taxRate?: string;
    discountAmount?: string;
    customerId?: string;
    issuedDate?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/invoices/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update invoice" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteInvoice(id: string) {
  try {
    const res = await fetch(`${API_URL}/invoices/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete invoice" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function sendInvoice(id: string) {
  try {
    const res = await fetch(`${API_URL}/invoices/${id}/send`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to send invoice" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getInvoicePdfUrl(id: string) {
  // Return the direct URL — the frontend can use this to open in a new tab
  return `${API_URL}/invoices/${id}/pdf`;
}

// ===== LINE ITEMS =====

export async function addInvoiceLineItem(
  invoiceId: string,
  data: {
    description?: string;
    unitPrice?: string;
    itemType?: string;
    quantity?: string;
    sortOrder?: number;
    catalogItemId?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/invoices/${invoiceId}/line-items`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to add line item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateInvoiceLineItem(
  invoiceId: string,
  lineItemId: string,
  data: {
    description?: string;
    quantity?: string;
    unitPrice?: string;
    sortOrder?: number;
    itemType?: string;
  },
) {
  try {
    const res = await fetch(
      `${API_URL}/invoices/${invoiceId}/line-items/${lineItemId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: await getCookieHeader(),
        },
        body: JSON.stringify(data),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return {
        data: null,
        error: err.message ?? "Failed to update line item",
      };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteInvoiceLineItem(
  invoiceId: string,
  lineItemId: string,
) {
  try {
    const res = await fetch(
      `${API_URL}/invoices/${invoiceId}/line-items/${lineItemId}`,
      {
        method: "DELETE",
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to remove line item" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== PAYMENTS =====

export async function recordPayment(
  invoiceId: string,
  data: {
    amount: string;
    paymentMethod?: string;
    paymentDate?: string;
    referenceNumber?: string;
    notes?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/invoices/${invoiceId}/payments`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify(data),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to record payment" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deletePayment(invoiceId: string, paymentId: string) {
  try {
    const res = await fetch(
      `${API_URL}/invoices/${invoiceId}/payments/${paymentId}`,
      {
        method: "DELETE",
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete payment" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== VOID =====

export async function voidInvoice(id: string) {
  try {
    const res = await fetch(`${API_URL}/invoices/${id}/void`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({}),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to void invoice" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== BULK OPERATIONS =====

export async function bulkArchiveInvoices(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/invoices/bulk-archive`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkRestoreInvoices(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/invoices/bulk-restore`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkDeleteInvoices(ids: string[]) {
  try {
    const res = await fetch(`${API_URL}/invoices/bulk-delete`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}

export async function bulkUpdateInvoiceStatus(ids: string[], status: string) {
  try {
    const res = await fetch(`${API_URL}/invoices/bulk-status-update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ ids, status }),
      cache: "no-store",
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { succeeded: 0, failed: ids.length, errors: [], error: (err as { message?: string }).message ?? "Failed" };
    }
    return await res.json();
  } catch {
    return { succeeded: 0, failed: ids.length, errors: [], error: "Network error" };
  }
}
