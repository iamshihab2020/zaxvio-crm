// ── Chatbot Type Definitions ──

export type ActionType =
  | "create_customer"
  | "create_event"
  | "create_job"
  | "create_invoice"
  | "create_quote"
  | "create_catalog_item"
  | "create_equipment"
  | "create_booking";

export type MessageType =
  | "text"
  | "action-confirm"
  | "action-result"
  | "customer-select"
  | "field-prompt";

export type Intent = "greeting" | "help" | "action" | "unknown";

export type ActionStatus =
  | "pending"
  | "confirmed"
  | "cancelled"
  | "executed"
  | "failed";

export type ConversationPhase =
  | "idle"
  | "awaiting_fields"
  | "awaiting_customer_selection"
  | "awaiting_confirmation";

export interface PendingAction {
  type: ActionType;
  params: Record<string, string>;
  status: ActionStatus;
  missingFields?: string[];
  customerSearchQuery?: string;
  customerResults?: CustomerSearchResult[];
}

export interface CustomerSearchResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "bot";
  content: string;
  timestamp: number;
  type: MessageType;
  actionData?: PendingAction;
}

export interface ConversationState {
  phase: ConversationPhase;
  pendingAction: PendingAction | null;
}

export interface IntentResult {
  intent: Intent;
  actionType?: ActionType;
  confidence: number;
}

export interface NormalizedMessage {
  original: string;
  normalized: string;
  extractedDate?: string; // YYYY-MM-DD
  extractedTime?: string; // HH:mm
}

export interface ParseResult {
  params: Record<string, string>;
  missingFields: string[];
  customerName?: string; // for entities needing customer lookup
}

export interface KnowledgeEntry {
  id: string;
  category: string;
  keywords: string[];
  question: string;
  answer: string;
}

export interface EntityField {
  key: string;
  label: string;
  required: boolean;
}

export interface EntityDefinition {
  name: string;
  actionType: ActionType;
  aliases: string[];
  requiredFields: EntityField[];
  optionalFields: EntityField[];
  fieldAliases: Record<string, string>;
  needsCustomerLookup: boolean;
}

// ── AI API Types ──

export interface ChatApiRequest {
  message: string;
  conversationState: ConversationState;
  history: Array<{ role: "user" | "assistant"; content: string }>;
}

export interface ChatApiResponse {
  messages: ChatMessage[];
  newState: ConversationState;
  error?: string;
}
