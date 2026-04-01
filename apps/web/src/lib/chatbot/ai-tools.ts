import { z } from "zod";
import { tool } from "ai";
import { format } from "date-fns";
import { KNOWLEDGE_BASE_ENTRIES } from "./knowledge-base";
import { ENTITY_DEFINITIONS, getEntityDefinition } from "./entity-definitions";
import type {
  ChatMessage,
  ConversationState,
  PendingAction,
  ActionType,
} from "./types";
import type { EngineResult } from "./engine";

// ── Helpers ──

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function botMessage(
  content: string,
  type: ChatMessage["type"] = "text",
  actionData?: PendingAction,
): ChatMessage {
  return {
    id: makeId(),
    role: "bot",
    content,
    timestamp: Date.now(),
    type,
    actionData,
  };
}

// ── System Prompt Builder ──

export function buildSystemPrompt(): string {
  const today = format(new Date(), "yyyy-MM-dd");

  const kbSection = KNOWLEDGE_BASE_ENTRIES.map(
    (entry) => `### ${entry.question}\n${entry.answer}`,
  ).join("\n\n");

  const entitySection = Object.values(ENTITY_DEFINITIONS)
    .map((def) => {
      const required = def.requiredFields.map((f) => `${f.label} (${f.key})`).join(", ");
      const optional = def.optionalFields.map((f) => `${f.label} (${f.key})`).join(", ");
      const aliases = def.aliases.join(", ");
      return `### ${def.name}\nAliases: ${aliases}\nRequired: ${required}\nOptional: ${optional}${def.needsCustomerLookup ? "\nNote: Requires customer name for lookup" : ""}`;
    })
    .join("\n\n");

  return `You are a concise, friendly assistant for a field service management application called Zaxvio CRM. You help service professionals manage their business.

Today's date: ${today}

## What You Can Do
1. Answer questions about how to use the app — use the answer_help tool
2. Create entities for the user — use the appropriate create_ tool
3. Greet users warmly — use the greet tool

## App Help Reference
${kbSection}

## Entity Reference (What Users Can Create)
${entitySection}

## Rules
- Parse dates in ANY format and return YYYY-MM-DD (e.g., "20.1.2026" → "2026-01-20", "tomorrow" → relative to today, "next Monday" → computed)
- Parse times and return HH:mm in 24-hour format (e.g., "9PM" → "21:00", "2:30pm" → "14:30")
- For messy comma-separated input like "Shihab, Repair, 20.1.2026", intelligently extract the fields based on context
- ALWAYS use a tool for your response — either answer_help, greet, or a create_ tool
- If the user is providing additional fields for an in-progress action, use the same create_ tool with all the fields (old + new)
- Be concise: 1-3 sentences max unless listing steps
- Do NOT mention tools, AI, models, or internal details
- Use industry-agnostic language (not HVAC-specific)
- If you genuinely cannot determine intent, respond without a tool call to ask for clarification`;
}

// ── Tool Definitions (Zod v4 schemas for AI SDK v6) ──

export function getChatTools() {
  return {
    greet: tool({
      description:
        "Respond to a greeting or casual message. Generate a friendly, contextual greeting.",
      inputSchema: z.object({
        greeting: z.string().describe("A friendly greeting response"),
      }),
    }),

    answer_help: tool({
      description:
        "Answer a question about how to use the app using the App Help Reference.",
      inputSchema: z.object({
        answer: z.string().describe("The help answer based on the knowledge base"),
      }),
    }),

    create_customer: tool({
      description: "Create a new customer/client/contact.",
      inputSchema: z.object({
        firstName: z.string().describe("Customer first name"),
        lastName: z.string().optional().default("").describe("Last name"),
        email: z.string().optional().describe("Email address"),
        phone: z.string().optional().describe("Phone number"),
        address: z.string().optional().describe("Street address"),
        city: z.string().optional().describe("City"),
        state: z.string().optional().describe("State"),
        zipCode: z.string().optional().describe("Zip code"),
      }),
    }),

    create_event: tool({
      description: "Create a calendar event/appointment/meeting/reminder.",
      inputSchema: z.object({
        title: z.string().describe("Event title"),
        eventDate: z.string().describe("Date in YYYY-MM-DD format"),
        startTime: z.string().optional().describe("Start time HH:mm 24h"),
        endTime: z.string().optional().describe("End time HH:mm 24h"),
        description: z.string().optional().describe("Details"),
        contactName: z.string().optional().describe("Contact name"),
        address: z.string().optional().describe("Location"),
        color: z.string().optional().describe("Color"),
      }),
    }),

    create_job: tool({
      description: "Create a service job/work order.",
      inputSchema: z.object({
        customerName: z.string().describe("Customer name to look up"),
        serviceType: z.string().describe("Service type"),
        title: z.string().describe("Job title"),
        scheduledDate: z.string().describe("Date YYYY-MM-DD"),
        description: z.string().optional().describe("Details"),
        scheduledStart: z.string().optional().describe("Start time HH:mm"),
        scheduledEnd: z.string().optional().describe("End time HH:mm"),
        address: z.string().optional().describe("Location"),
        priority: z.string().optional().describe("standard/urgent/emergency"),
        notes: z.string().optional().describe("Notes"),
      }),
    }),

    create_invoice: tool({
      description: "Create an invoice/bill for a customer.",
      inputSchema: z.object({
        customerName: z.string().describe("Customer name to look up"),
        dueDate: z.string().optional().describe("Due date YYYY-MM-DD"),
        taxRate: z.string().optional().describe("Tax rate as decimal"),
        discountAmount: z.string().optional().describe("Discount amount"),
        notes: z.string().optional().describe("Notes"),
      }),
    }),

    create_quote: tool({
      description: "Create a quote/estimate/proposal.",
      inputSchema: z.object({
        customerName: z.string().describe("Customer name to look up"),
        expiryDate: z.string().optional().describe("Expiry date YYYY-MM-DD"),
        taxRate: z.string().optional().describe("Tax rate as decimal"),
        discountAmount: z.string().optional().describe("Discount amount"),
        notes: z.string().optional().describe("Notes"),
      }),
    }),

    create_catalog_item: tool({
      description: "Add a new item to the service catalog.",
      inputSchema: z.object({
        name: z.string().describe("Item name"),
        itemType: z.string().describe("Type: parts, labor, or flat_rate"),
        unitPrice: z.string().describe("Price (no currency symbol)"),
        unit: z.string().optional().describe("Unit"),
        category: z.string().optional().describe("Category"),
        description: z.string().optional().describe("Description"),
      }),
    }),

    create_equipment: tool({
      description: "Add equipment/asset for a customer.",
      inputSchema: z.object({
        customerName: z.string().describe("Customer name to look up"),
        equipmentType: z.string().describe("Equipment type"),
        brand: z.string().optional().describe("Brand"),
        model: z.string().optional().describe("Model"),
        serialNumber: z.string().optional().describe("Serial number"),
        installDate: z.string().optional().describe("Install date YYYY-MM-DD"),
        warrantyExpiry: z.string().optional().describe("Warranty expiry YYYY-MM-DD"),
        location: z.string().optional().describe("Location"),
        notes: z.string().optional().describe("Notes"),
      }),
    }),

    create_booking: tool({
      description: "Create a service booking/reservation.",
      inputSchema: z.object({
        customerName: z.string().describe("Customer name"),
        serviceType: z.string().describe("Service type"),
        bookingDate: z.string().describe("Date YYYY-MM-DD"),
        preferredTime: z.string().optional().describe("Time HH:mm"),
        customerEmail: z.string().optional().describe("Email"),
        customerPhone: z.string().optional().describe("Phone"),
        address: z.string().optional().describe("Address"),
        description: z.string().optional().describe("Description"),
      }),
    }),
  };
}

// ── Tool Call → EngineResult Mapper ──

const TOOL_TO_ACTION_TYPE: Record<string, ActionType> = {
  create_customer: "create_customer",
  create_event: "create_event",
  create_job: "create_job",
  create_invoice: "create_invoice",
  create_quote: "create_quote",
  create_catalog_item: "create_catalog_item",
  create_equipment: "create_equipment",
  create_booking: "create_booking",
};

export function mapToolCallToEngineResult(
  toolName: string,
  toolArgs: Record<string, string | undefined>,
  _state: ConversationState,
): EngineResult {
  if (toolName === "greet") {
    return {
      messages: [botMessage(toolArgs.greeting ?? "Hello! How can I help you?")],
      newState: { phase: "idle", pendingAction: null },
    };
  }

  if (toolName === "answer_help") {
    return {
      messages: [botMessage(toolArgs.answer ?? "I'm not sure about that. Try asking a specific question.")],
      newState: { phase: "idle", pendingAction: null },
    };
  }

  const actionType = TOOL_TO_ACTION_TYPE[toolName];
  if (!actionType) {
    return {
      messages: [botMessage("I'm not sure how to do that. Can you rephrase?")],
      newState: { phase: "idle", pendingAction: null },
    };
  }

  const def = getEntityDefinition(actionType);
  if (!def) {
    return {
      messages: [botMessage("Something went wrong. Please try again.")],
      newState: { phase: "idle", pendingAction: null },
    };
  }

  // Clean params
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(toolArgs)) {
    if (value !== undefined && value !== "") {
      params[key] = value;
    }
  }

  // Check missing required fields
  const missingFields: string[] = [];
  for (const field of def.requiredFields) {
    if (field.key === "customerId" && def.needsCustomerLookup) continue;
    if (!params[field.key] || params[field.key].trim() === "") {
      missingFields.push(field.label);
    }
  }

  if (missingFields.length > 0) {
    const pendingAction: PendingAction = {
      type: actionType,
      params,
      status: "pending",
      missingFields,
    };
    const fieldList = missingFields.map((f) => `• **${f}**`).join("\n");
    return {
      messages: [
        botMessage(
          `To create a **${def.name}**, I need a few more details:\n\n${fieldList}\n\nPlease provide the missing information.`,
          "field-prompt",
          pendingAction,
        ),
      ],
      newState: { phase: "awaiting_fields", pendingAction },
    };
  }

  // Customer lookup needed?
  if (def.needsCustomerLookup && params.customerName && !params.customerId) {
    const pendingAction: PendingAction = {
      type: actionType,
      params,
      status: "pending",
      customerSearchQuery: params.customerName,
    };
    return {
      messages: [botMessage(`Looking up customer **"${params.customerName}"**...`)],
      newState: { phase: "awaiting_customer_selection", pendingAction },
    };
  }

  // All complete — confirmation
  const lines: string[] = [];
  const allFields = [...def.requiredFields, ...def.optionalFields];
  for (const field of allFields) {
    const value = params[field.key];
    if (value && value.trim() !== "" && field.key !== "customerId") {
      lines.push(`• **${field.label}**: ${value}`);
    }
  }
  if (params.customerName && def.needsCustomerLookup) {
    lines.unshift(`• **Customer**: ${params.customerName}`);
  }

  const pendingAction: PendingAction = {
    type: actionType,
    params,
    status: "pending",
  };

  return {
    messages: [
      botMessage(
        `I'll create a **${def.name}** with these details:\n\n${lines.join("\n")}\n\nConfirm or cancel?`,
        "action-confirm",
        pendingAction,
      ),
    ],
    newState: { phase: "awaiting_confirmation", pendingAction },
  };
}
