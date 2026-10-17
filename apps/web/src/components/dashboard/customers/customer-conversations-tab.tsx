"use client";

import { useState, useEffect, useCallback } from "react";
import { IconMessageCircle, IconMail } from "@tabler/icons-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationThread } from "@/components/dashboard/conversations/conversation-thread";
import { ComposeBar } from "@/components/dashboard/conversations/compose-bar";
import {
  getConversations,
  getConversationMessages,
} from "@/lib/client-reads/conversations";
import {
  getOrCreateConversation,
  sendMessage,
  type Conversation,
  type Message,
} from "@/actions/conversations";

interface CustomerConversationsTabProps {
  customerId: string;
}

export function CustomerConversationsTab({ customerId }: CustomerConversationsTabProps) {
  const [convos, setConvos] = useState<Conversation[]>([]);
  const [activeConvo, setActiveConvo] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoadingConvos, setIsLoadingConvos] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);

  // Fetch conversations for this customer on mount
  useEffect(() => {
    setIsLoadingConvos(true);
    getConversations({ customerId, limit: 10 }).then((res) => {
      if (res.data) {
        setConvos(res.data);
        // Auto-select the most recent conversation
        if (res.data.length > 0) {
          selectConversation(res.data[0]);
        }
      }
      setIsLoadingConvos(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerId]);

  const selectConversation = useCallback(async (convo: Conversation) => {
    setActiveConvo(convo);
    setIsLoadingMessages(true);
    setMessages([]);
    const res = await getConversationMessages(convo.id);
    if (res.data) setMessages(res.data);
    setIsLoadingMessages(false);
  }, []);

  const handleStartConversation = async () => {
    setIsCreating(true);
    const res = await getOrCreateConversation(customerId, "email");
    if (res.data) {
      setConvos((prev) => {
        const exists = prev.find((c) => c.id === res.data!.id);
        return exists ? prev : [res.data!, ...prev];
      });
      await selectConversation(res.data);
    }
    setIsCreating(false);
  };

  const handleSend = async () => {
    if (!activeConvo || !inputText.trim() || isSending) return;
    const body = inputText.trim();
    setInputText("");
    setIsSending(true);

    // Optimistic message
    const tempId = `optimistic-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      conversationId: activeConvo.id,
      tenantId: activeConvo.tenantId,
      direction: "outbound",
      channel: "email",
      body,
      subject: activeConvo.subject,
      status: "sent",
      externalId: null,
      senderId: null,
      createdAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, optimistic]);

    const res = await sendMessage(activeConvo.id, body, activeConvo.subject ?? undefined);
    setIsSending(false);

    if (res.data) {
      setMessages((prev) =>
        prev.map((m) => (m.id === tempId ? res.data! : m)),
      );
    } else {
      // Revert optimistic on failure
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setInputText(body);
    }
  };

  // ── Loading ──────────────────────────────────────────────────────────────
  if (isLoadingConvos) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-14 w-full" />
      </div>
    );
  }

  // ── Empty: no conversations yet ──────────────────────────────────────────
  if (convos.length === 0 && !isCreating) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/20 py-16 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-light mb-3">
          <IconMessageCircle className="h-5 w-5 text-brand" />
        </div>
        <p className="text-sm font-medium text-foreground font-body">
          No conversations yet
        </p>
        <p className="text-xs text-muted-foreground mt-1 mb-4">
          Start an email conversation with this customer
        </p>
        <Button size="sm" onClick={handleStartConversation} disabled={isCreating} className="h-10 sm:h-8">
          <IconMail className="h-4 w-4 mr-1.5" />
          Start Email Conversation
        </Button>
      </div>
    );
  }

  // ── Chat UI ──────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[520px] max-h-[75dvh] flex-col rounded-lg border border-border overflow-hidden">
      {/* Conversation selector — shown when multiple threads exist */}
      {convos.length > 1 && (
        <div className="flex gap-1.5 items-center overflow-x-auto px-3 py-2 border-b border-border bg-muted/30 shrink-0">
          {convos.map((c) => (
            <button
              key={c.id}
              onClick={() => selectConversation(c)}
              className={`flex min-h-10 items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium shrink-0 transition-colors sm:min-h-0 ${
                activeConvo?.id === c.id
                  ? "bg-brand text-brand-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground"
              }`}
            >
              <IconMail className="h-3 w-3" />
              {c.subject ?? "Email thread"}
              {c.unreadCount > 0 && (
                <Badge className="h-4 px-1 text-[10px] bg-card text-brand-ink ml-0.5">
                  {c.unreadCount}
                </Badge>
              )}
            </button>
          ))}
          <button
            onClick={handleStartConversation}
            disabled={isCreating}
            className="flex min-h-10 items-center gap-1 px-2.5 py-1 rounded-full text-xs text-muted-foreground hover:text-foreground bg-muted shrink-0 transition-colors sm:min-h-0"
          >
            {/* The label says it is working; the button is disabled meanwhile. */}
            {isCreating ? (
              "Starting…"
            ) : (
              <>
                <span className="text-base leading-none">+</span>
                New
              </>
            )}
          </button>
        </div>
      )}

      {/* Thread */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <ConversationThread messages={messages} isLoading={isLoadingMessages} />
      </div>

      {/* Compose */}
      <ComposeBar
        value={inputText}
        onChange={setInputText}
        onSend={handleSend}
        isSending={isSending}
        channel="email"
      />
    </div>
  );
}
