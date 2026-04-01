"use client";

import { useState, useEffect, useCallback } from "react";
import type { ChatMessage, ConversationState, PendingAction } from "@/lib/chatbot/types";
import { processMessage } from "@/lib/chatbot/engine";
import { executeAction, searchCustomersForChatbot } from "@/lib/chatbot/action-executor";

const STORAGE_KEY = "chatbot-messages";
const MAX_MESSAGES = 50;
const MESSAGE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

function makeId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function loadMessages(): ChatMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const messages: ChatMessage[] = JSON.parse(stored);
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    return messages.filter((m) => m.timestamp > cutoff).slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

function saveMessages(messages: ChatMessage[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(messages.slice(-MAX_MESSAGES)),
    );
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

export function useChatbot() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [conversationState, setConversationState] = useState<ConversationState>({
    phase: "idle",
    pendingAction: null,
  });

  // Load messages from localStorage on mount
  useEffect(() => {
    setMessages(loadMessages());
  }, []);

  // Save messages whenever they change
  useEffect(() => {
    if (messages.length > 0) {
      saveMessages(messages);
    }
  }, [messages]);

  const addMessages = useCallback((newMessages: ChatMessage[]) => {
    setMessages((prev) => [...prev, ...newMessages].slice(-MAX_MESSAGES));
  }, []);

  /** Send a user message and get bot response */
  const sendMessage = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || isProcessing) return;

      // Add user message
      const userMsg: ChatMessage = {
        id: makeId(),
        role: "user",
        content: trimmed,
        timestamp: Date.now(),
        type: "text",
      };
      addMessages([userMsg]);
      setIsProcessing(true);

      try {
        // Build conversation history for AI context
        const history = messages.slice(-10).map((m) => ({
          role: m.role === "user" ? ("user" as const) : ("assistant" as const),
          content: m.content,
        }));

        // Process through the AI engine
        const result = await processMessage(trimmed, conversationState, history);

        // Handle customer search flow — if we're entering customer selection, perform the search
        if (
          result.newState.phase === "awaiting_customer_selection" &&
          result.newState.pendingAction?.customerSearchQuery
        ) {
          const searchQuery = result.newState.pendingAction.customerSearchQuery;
          const searchResult = await searchCustomersForChatbot(searchQuery);

          if (searchResult.error) {
            addMessages([
              {
                id: makeId(),
                role: "bot",
                content: `Error searching customers: ${searchResult.error}. Please try again.`,
                timestamp: Date.now(),
                type: "text",
              },
            ]);
            setConversationState({ phase: "idle", pendingAction: null });
          } else if (searchResult.customers.length === 0) {
            addMessages([
              {
                id: makeId(),
                role: "bot",
                content: `No customers found matching **"${searchQuery}"**. Please create the customer first, or try a different name.`,
                timestamp: Date.now(),
                type: "text",
              },
            ]);
            setConversationState({ phase: "idle", pendingAction: null });
          } else if (searchResult.customers.length === 1) {
            // Single match — auto-select and show confirmation
            const customer = searchResult.customers[0]!;
            const updatedAction: PendingAction = {
              ...result.newState.pendingAction,
              params: {
                ...result.newState.pendingAction.params,
                customerId: customer.id,
                customerName: `${customer.firstName} ${customer.lastName}`.trim(),
              },
              customerResults: searchResult.customers,
            };

            addMessages([
              {
                id: makeId(),
                role: "bot",
                content: `Found **${customer.firstName} ${customer.lastName}**${customer.email ? ` (${customer.email})` : ""}. Using this customer.`,
                timestamp: Date.now(),
                type: "text",
              },
            ]);

            // Re-process to build confirmation with the customer selected
            const confirmResult = await processMessage(
              "yes",
              { phase: "awaiting_customer_selection", pendingAction: updatedAction },
            );
            addMessages(confirmResult.messages);
            setConversationState(confirmResult.newState);
          } else {
            // Multiple matches — show selection
            const updatedAction: PendingAction = {
              ...result.newState.pendingAction,
              customerResults: searchResult.customers,
            };

            const customerList = searchResult.customers
              .map(
                (c, i) =>
                  `${i + 1}. **${c.firstName} ${c.lastName}**${c.email ? ` (${c.email})` : ""}`,
              )
              .join("\n");

            addMessages([
              {
                id: makeId(),
                role: "bot",
                content: `Found ${searchResult.customers.length} customers matching **"${searchQuery}"**:\n\n${customerList}\n\nType a number to select, or "cancel" to cancel.`,
                timestamp: Date.now(),
                type: "customer-select",
                actionData: updatedAction,
              },
            ]);
            setConversationState({
              phase: "awaiting_customer_selection",
              pendingAction: updatedAction,
            });
          }
        } else {
          addMessages(result.messages);
          setConversationState(result.newState);
        }
      } catch (err) {
        addMessages([
          {
            id: makeId(),
            role: "bot",
            content: "Something went wrong. Please try again.",
            timestamp: Date.now(),
            type: "text",
          },
        ]);
        setConversationState({ phase: "idle", pendingAction: null });
        console.error("Chatbot error:", err);
      } finally {
        setIsProcessing(false);
      }
    },
    [isProcessing, conversationState, addMessages],
  );

  /** Confirm a pending action */
  const confirmAction = useCallback(async () => {
    const action = conversationState.pendingAction;
    if (!action) return;

    setIsProcessing(true);

    try {
      const result = await executeAction(action);

      if (result.success) {
        addMessages([
          {
            id: makeId(),
            role: "bot",
            content: `✓ **${result.entityName}** created successfully!`,
            timestamp: Date.now(),
            type: "action-result",
          },
        ]);
      } else {
        addMessages([
          {
            id: makeId(),
            role: "bot",
            content: `✗ Failed to create ${result.entityName}: ${result.error}`,
            timestamp: Date.now(),
            type: "action-result",
          },
        ]);
      }
    } catch (err) {
      addMessages([
        {
          id: makeId(),
          role: "bot",
          content: "✗ An unexpected error occurred. Please try again.",
          timestamp: Date.now(),
          type: "action-result",
        },
      ]);
      console.error("Action execution error:", err);
    } finally {
      setConversationState({ phase: "idle", pendingAction: null });
      setIsProcessing(false);
    }
  }, [conversationState, addMessages]);

  /** Cancel a pending action */
  const cancelAction = useCallback(() => {
    addMessages([
      {
        id: makeId(),
        role: "bot",
        content: "Action cancelled. What else can I help with?",
        timestamp: Date.now(),
        type: "text",
      },
    ]);
    setConversationState({ phase: "idle", pendingAction: null });
  }, [addMessages]);

  /** Select a customer from search results */
  const selectCustomer = useCallback(
    (index: number) => {
      // Delegate to sendMessage which handles the conversation state
      sendMessage(String(index));
    },
    [sendMessage],
  );

  /** Clear chat history */
  const clearHistory = useCallback(() => {
    setMessages([]);
    setConversationState({ phase: "idle", pendingAction: null });
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return {
    messages,
    isOpen,
    isProcessing,
    conversationState,
    setIsOpen,
    sendMessage,
    confirmAction,
    cancelAction,
    selectCustomer,
    clearHistory,
  };
}
