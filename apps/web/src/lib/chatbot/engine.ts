import type {
  ChatMessage,
  ConversationState,
  PendingAction,
  ChatApiRequest,
  ChatApiResponse,
} from "./types";
import { getEntityDefinition } from "./entity-definitions";

// ── Types ──

export interface EngineResult {
  messages: ChatMessage[];
  newState: ConversationState;
}

// ── Helpers ──

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function botMessage(content: string): ChatMessage {
  return {
    id: makeId(),
    role: "bot",
    content,
    timestamp: Date.now(),
    type: "text",
  };
}

// ── Customer Selection (Local — no AI needed) ──

function handleCustomerSelection(
  text: string,
  state: ConversationState,
): EngineResult {
  const action = state.pendingAction!;
  const customers = action.customerResults ?? [];
  const lower = text.toLowerCase().trim();

  // User types a number to select
  const num = parseInt(text.trim(), 10);
  if (num >= 1 && num <= customers.length) {
    const selected = customers[num - 1];
    if (selected) {
      const updatedParams = {
        ...action.params,
        customerId: selected.id,
        customerName: `${selected.firstName} ${selected.lastName}`.trim(),
      };
      return buildConfirmation(action.type, updatedParams);
    }
  }

  // Single result: "yes" or "1" to confirm
  if (
    customers.length === 1 &&
    (lower === "yes" || lower === "y" || lower === "1" || lower === "ok" || lower === "confirm")
  ) {
    const selected = customers[0]!;
    const updatedParams = {
      ...action.params,
      customerId: selected.id,
      customerName: `${selected.firstName} ${selected.lastName}`.trim(),
    };
    return buildConfirmation(action.type, updatedParams);
  }

  // Cancel
  if (lower === "cancel" || lower === "no" || lower === "n" || lower === "nevermind") {
    return {
      messages: [botMessage("Action cancelled. What else can I help with?")],
      newState: { phase: "idle", pendingAction: null },
    };
  }

  return {
    messages: [
      botMessage(
        customers.length > 0
          ? `Please type a number (1-${customers.length}) to select a customer, or "cancel" to cancel.`
          : 'No customers found. Say "cancel" to cancel or try a different name.',
      ),
    ],
    newState: state,
  };
}

function buildConfirmation(
  actionType: string,
  params: Record<string, string>,
): EngineResult {
  const def = getEntityDefinition(actionType);

  if (!def) {
    return {
      messages: [botMessage("Something went wrong. Please try again.")],
      newState: { phase: "idle", pendingAction: null },
    };
  }

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

  const summary = lines.join("\n");
  const pendingAction: PendingAction = {
    type: actionType as PendingAction["type"],
    params,
    status: "pending",
  };

  return {
    messages: [
      {
        id: makeId(),
        role: "bot",
        content: `I'll create a **${def.name}** with these details:\n\n${summary}\n\nConfirm or cancel?`,
        timestamp: Date.now(),
        type: "action-confirm",
        actionData: pendingAction,
      },
    ],
    newState: { phase: "awaiting_confirmation", pendingAction },
  };
}

// ── Main Engine (AI-Powered) ──

export async function processMessage(
  text: string,
  state: ConversationState,
  history?: Array<{ role: "user" | "assistant"; content: string }>,
): Promise<EngineResult> {
  // Customer selection is handled locally (just number parsing)
  if (state.phase === "awaiting_customer_selection") {
    return handleCustomerSelection(text, state);
  }

  // Call the AI API route
  try {
    const request: ChatApiRequest = {
      message: text,
      conversationState: state,
      history: history ?? [],
    };

    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      console.error("Chat API error:", res.status, errorText);
      return {
        messages: [botMessage("Something went wrong. Please try again.")],
        newState: { phase: "idle", pendingAction: null },
      };
    }

    const data: ChatApiResponse = await res.json();

    if (data.error && data.messages.length === 0) {
      return {
        messages: [botMessage(data.error)],
        newState: { phase: "idle", pendingAction: null },
      };
    }

    return {
      messages: data.messages,
      newState: data.newState,
    };
  } catch (err) {
    console.error("Chat engine error:", err);
    return {
      messages: [
        botMessage(
          "I'm having trouble connecting. Please check your internet and try again.",
        ),
      ],
      newState: { phase: "idle", pendingAction: null },
    };
  }
}
