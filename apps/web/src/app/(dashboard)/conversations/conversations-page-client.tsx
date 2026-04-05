"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { IconArrowLeft } from "@tabler/icons-react";
import { ConversationList } from "@/components/dashboard/conversations/conversation-list";
import { ConversationThread } from "@/components/dashboard/conversations/conversation-thread";
import { ConversationHeader } from "@/components/dashboard/conversations/conversation-header";
import { ConversationEmpty } from "@/components/dashboard/conversations/conversation-empty";
import { ComposeBar } from "@/components/dashboard/conversations/compose-bar";
import { NewConversationDialog } from "@/components/dashboard/conversations/new-conversation-dialog";
import { useConversationRealtime } from "@/hooks/use-conversation-realtime";
import { useDesktopNotifications } from "@/hooks/use-desktop-notifications";
import {
  getConversationMessages,
  sendMessage,
  markConversationRead,
  getOrCreateConversation,
} from "@/actions/conversations";
import type { Conversation, Message } from "@/actions/conversations";

interface ConversationsPageClientProps {
  initialConversations: Conversation[];
  tenantId: string | null;
}

export function ConversationsPageClient({
  initialConversations,
  tenantId,
}: ConversationsPageClientProps) {
  const [conversations, setConversations] =
    useState<Conversation[]>(initialConversations);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isNewDialogOpen, setIsNewDialogOpen] = useState(false);
  const [isCreatingConversation, setIsCreatingConversation] = useState(false);
  // Mobile: show thread or list
  const [showThread, setShowThread] = useState(false);

  const { notify } = useDesktopNotifications();

  const activeConversation = conversations.find((c) => c.id === activeId) ?? null;

  // ── Realtime ──────────────────────────────────────────────────────────────

  const handleNewMessage = useCallback(
    (payload: { conversationId: string; message: Message }) => {
      const { conversationId, message } = payload;

      // If this is the active conversation, append the message
      if (conversationId === activeId) {
        setMessages((prev) => {
          // Avoid duplicates (optimistic updates)
          if (prev.some((m) => m.id === message.id)) return prev;
          return [...prev, message];
        });
      } else {
        // Update unread count in conversation list
        setConversations((prev) =>
          prev.map((c) =>
            c.id === conversationId
              ? { ...c, unreadCount: c.unreadCount + 1, lastMessageAt: message.createdAt }
              : c,
          ),
        );

        // Desktop notification for messages in other conversations
        const conv = conversations.find((c) => c.id === conversationId);
        if (conv) {
          const name = `${conv.customerFirstName} ${conv.customerLastName}`;
          notify(`New message from ${name}`, message.body.slice(0, 80));
        }
      }
    },
    [activeId, conversations, notify],
  );

  useConversationRealtime(tenantId, handleNewMessage);

  // ── Select conversation ───────────────────────────────────────────────────

  async function handleSelectConversation(id: string) {
    setActiveId(id);
    setShowThread(true);
    setMessages([]);
    setIsLoadingMessages(true);

    const [msgsResult] = await Promise.all([
      getConversationMessages(id),
      markConversationRead(id),
    ]);

    if (msgsResult.data) {
      setMessages(msgsResult.data);
    }
    setIsLoadingMessages(false);

    // Clear unread count locally
    setConversations((prev) =>
      prev.map((c) => (c.id === id ? { ...c, unreadCount: 0 } : c)),
    );
  }

  // ── Send message ──────────────────────────────────────────────────────────

  async function handleSend() {
    if (!inputText.trim() || !activeId || isSending) return;

    const body = inputText.trim();
    setInputText("");
    setIsSending(true);

    // Optimistic append
    const optimisticMsg: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: activeId,
      tenantId: tenantId ?? "",
      direction: "outbound",
      channel: "email",
      body,
      subject: null,
      status: "queued",
      externalId: null,
      senderId: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimisticMsg]);

    const result = await sendMessage(activeId, body);

    if (result.data) {
      // Replace optimistic message with real one
      setMessages((prev) =>
        prev.map((m) =>
          m.id === optimisticMsg.id ? result.data! : m,
        ),
      );
      // Update lastMessageAt in list
      setConversations((prev) =>
        prev.map((c) =>
          c.id === activeId
            ? { ...c, lastMessageAt: result.data!.createdAt }
            : c,
        ),
      );
    } else {
      // Remove optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== optimisticMsg.id));
      setInputText(body); // restore
    }

    setIsSending(false);
  }

  // ── New conversation ──────────────────────────────────────────────────────

  async function handleNewConversation(
    customerId: string,
    channel: "sms" | "email",
    subject?: string,
  ) {
    setIsCreatingConversation(true);
    const result = await getOrCreateConversation(customerId, channel, subject);
    setIsCreatingConversation(false);

    if (result.data) {
      setIsNewDialogOpen(false);

      // Add to list if not already present
      setConversations((prev) => {
        if (prev.some((c) => c.id === result.data!.id)) return prev;
        return [result.data!, ...prev];
      });

      // Select it
      await handleSelectConversation(result.data.id);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
        {/* Left panel — conversation list */}
        <div
          className={`w-full lg:w-80 shrink-0 border-r border-border flex flex-col bg-card ${
            showThread ? "hidden lg:flex" : "flex"
          }`}
        >
          <ConversationList
            conversations={conversations}
            activeId={activeId}
            onSelect={handleSelectConversation}
            onNew={() => setIsNewDialogOpen(true)}
          />
        </div>

        {/* Right panel — thread */}
        <div
          className={`flex-1 flex flex-col min-w-0 bg-background ${
            showThread ? "flex" : "hidden lg:flex"
          }`}
        >
          {/* Mobile back button */}
          {showThread && (
            <div className="flex lg:hidden items-center px-3 py-2 border-b border-border bg-card">
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs"
                onClick={() => {
                  setShowThread(false);
                  setActiveId(null);
                }}
              >
                <IconArrowLeft className="h-3.5 w-3.5" />
                Back
              </Button>
            </div>
          )}

          {activeConversation ? (
            <>
              <ConversationHeader conversation={activeConversation} />
              <ConversationThread
                messages={messages}
                isLoading={isLoadingMessages}
              />
              <ComposeBar
                value={inputText}
                onChange={setInputText}
                onSend={handleSend}
                isSending={isSending}
                channel={activeConversation.channel}
              />
            </>
          ) : (
            <ConversationEmpty />
          )}
        </div>
      </div>

      <NewConversationDialog
        open={isNewDialogOpen}
        onOpenChange={setIsNewDialogOpen}
        onConfirm={handleNewConversation}
        isLoading={isCreatingConversation}
      />
    </>
  );
}
