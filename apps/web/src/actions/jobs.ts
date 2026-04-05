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

// ===== JOBS CRUD =====

export async function getJobs(params?: {
  search?: string;
  status?: string;
  customerId?: string;
  serviceType?: string;
  priority?: string;
  dateFrom?: string;
  dateTo?: string;
  pipelineId?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: string;
}) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.pipelineId) searchParams.set("pipelineId", params.pipelineId);
    if (params?.search) searchParams.set("search", params.search);
    if (params?.status) searchParams.set("status", params.status);
    if (params?.customerId) searchParams.set("customerId", params.customerId);
    if (params?.serviceType) searchParams.set("serviceType", params.serviceType);
    if (params?.priority) searchParams.set("priority", params.priority);
    if (params?.dateFrom) searchParams.set("dateFrom", params.dateFrom);
    if (params?.dateTo) searchParams.set("dateTo", params.dateTo);
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.sortBy) searchParams.set("sortBy", params.sortBy);
    if (params?.sortOrder) searchParams.set("sortOrder", params.sortOrder);

    const qs = searchParams.toString();
    const res = await fetch(`${API_URL}/jobs${qs ? `?${qs}` : ""}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch jobs" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getJob(id: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${id}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Job not found" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function createJob(data: {
  customerId: string;
  serviceType: string;
  title: string;
  scheduledDate: string;
  description?: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  address?: string;
  priority?: string;
  taxRate?: string;
  notes?: string;
  bookingId?: string;
  status?: string;
  equipmentId?: string;
  pipelineId?: string;
  assigneeId?: string | null;
}) {
  try {
    const res = await fetch(`${API_URL}/jobs`, {
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
      return { data: null, error: err.message ?? "Failed to create job" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateJob(
  id: string,
  data: {
    title?: string;
    description?: string;
    priority?: string;
    serviceType?: string;
    scheduledDate?: string;
    scheduledStart?: string;
    scheduledEnd?: string;
    address?: string;
    notes?: string;
    taxRate?: string;
    equipmentId?: string | null;
    assigneeId?: string | null;
  },
) {
  try {
    const res = await fetch(`${API_URL}/jobs/${id}`, {
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
      return { data: null, error: err.message ?? "Failed to update job" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getJobAssignees() {
  try {
    const res = await fetch(`${API_URL}/jobs/assignees`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch assignees" };
    }

    const json = await res.json();
    return {
      data: json.data as Array<{ id: string; name: string; image: string | null; email: string; role: string }>,
      error: null,
    };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateJobStatus(id: string, status: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${id}/status`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ status }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update job status" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function reorderJobs(
  items: { id: string; sortOrder: number; status?: string }[],
) {
  try {
    const res = await fetch(`${API_URL}/jobs/reorder`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ items }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to reorder jobs" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

export async function deleteJob(id: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${id}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete job" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== LINE ITEMS =====

export async function getJobLineItems(jobId: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/line-items`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch line items" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function addJobLineItem(
  jobId: string,
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
    const res = await fetch(`${API_URL}/jobs/${jobId}/line-items`, {
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

export async function updateJobLineItem(
  jobId: string,
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
      `${API_URL}/jobs/${jobId}/line-items/${lineItemId}`,
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
      return { data: null, error: err.message ?? "Failed to update line item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function removeJobLineItem(jobId: string, lineItemId: string) {
  try {
    const res = await fetch(
      `${API_URL}/jobs/${jobId}/line-items/${lineItemId}`,
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

// ===== CHECKLIST =====

export async function getJobChecklist(jobId: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/checklist`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch checklist" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function toggleChecklistItem(
  jobId: string,
  completionId: string,
  isCompleted: boolean,
) {
  try {
    const res = await fetch(
      `${API_URL}/jobs/${jobId}/checklist/${completionId}`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          cookie: await getCookieHeader(),
        },
        body: JSON.stringify({ isCompleted }),
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to toggle checklist item" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

// ===== PHOTOS =====

export async function uploadJobFile(
  jobId: string,
  fileData: { base64: string; filename: string; mimeType: string },
  tag: "before" | "after" | "general" = "general",
) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/upload`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({
        data: fileData.base64,
        filename: fileData.filename,
        mimeType: fileData.mimeType,
        tag,
      }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to upload file" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function getJobPhotos(jobId: string, tag?: string) {
  try {
    const qs = tag ? `?tag=${tag}` : "";
    const res = await fetch(`${API_URL}/jobs/${jobId}/photos${qs}`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch photos" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function addJobPhoto(
  jobId: string,
  data: {
    storagePath: string;
    caption?: string;
    tag?: "before" | "after" | "general";
    fileSize?: number;
    takenAt?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/photos`, {
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
      return { data: null, error: err.message ?? "Failed to add photo" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function updateJobPhotoTag(
  jobId: string,
  photoId: string,
  tag: "before" | "after" | "general",
) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/photos/${photoId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        cookie: await getCookieHeader(),
      },
      body: JSON.stringify({ tag }),
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to update photo tag" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteJobPhoto(jobId: string, photoId: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/photos/${photoId}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete photo" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== DOCUMENTS =====

export async function getJobDocuments(jobId: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/documents`, {
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch documents" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function addJobDocument(
  jobId: string,
  data: {
    storagePath: string;
    fileName: string;
    fileSize?: number;
    mimeType?: string;
    customerId?: string;
  },
) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/documents`, {
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
      return { data: null, error: err.message ?? "Failed to add document" };
    }

    const json = await res.json();
    return { data: json.data, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}

export async function deleteJobDocument(jobId: string, docId: string) {
  try {
    const res = await fetch(`${API_URL}/jobs/${jobId}/documents/${docId}`, {
      method: "DELETE",
      headers: { cookie: await getCookieHeader() },
      cache: "no-store",
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { error: err.message ?? "Failed to delete document" };
    }

    return { error: null };
  } catch {
    return { error: "Network error" };
  }
}

// ===== ACTIVITIES =====

export async function getJobActivities(
  jobId: string,
  params?: { page?: number; limit?: number },
) {
  try {
    const searchParams = new URLSearchParams();
    if (params?.page) searchParams.set("page", String(params.page));
    if (params?.limit) searchParams.set("limit", String(params.limit));

    const qs = searchParams.toString();
    const res = await fetch(
      `${API_URL}/jobs/${jobId}/activities${qs ? `?${qs}` : ""}`,
      {
        headers: { cookie: await getCookieHeader() },
        cache: "no-store",
      },
    );

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { data: null, error: err.message ?? "Failed to fetch activities" };
    }

    const json = await res.json();
    return { data: json.data, pagination: json.pagination, error: null };
  } catch {
    return { data: null, error: "Network error" };
  }
}
