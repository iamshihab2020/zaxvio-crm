"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { Skeleton } from "@/components/ui/skeleton";
import { prefersReducedMotion } from "@/lib/motion";
import { useStagger } from "@/hooks/use-stagger";
import { useNewIds } from "@/hooks/use-new-ids";
import type { Message } from "@/actions/conversations";

interface ConversationThreadProps {
  messages: Message[];
  isLoading: boolean;
  /** Which conversation is open, so opening another lays its history down again. */
  conversationId?: string | null;
}

function formatDateSeparator(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined,
  });
}

export function ConversationThread({
  messages,
  isLoading,
  conversationId,
}: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const groupsRef = useRef<HTMLDivElement>(null);
  const filledBefore = useRef(false);

  // Auto-scroll to bottom when messages change. Opening a thread jumps to the
  // end (a smooth scroll through a month of history is a long way to watch);
  // a message arriving after that eases into view.
  useEffect(() => {
    if (messages.length === 0) {
      filledBefore.current = false;
      return;
    }
    const smooth = filledBefore.current && !prefersReducedMotion();
    bottomRef.current?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
    filledBefore.current = true;
  }, [messages]);

  // The history rises in, day by day, when a conversation finishes loading.
  useStagger(
    groupsRef,
    isLoading || messages.length === 0 ? null : (conversationId ?? "thread"),
  );

  // A message that arrives while the thread is open (just sent, or pushed in
  // over the realtime stream) rises into place. The first load is the baseline,
  // so opening a thread animates nothing here.
  const fresh = useNewIds(
    messages.map((m) => m.id),
    !isLoading,
  );

  if (isLoading) {
    return (
      <div className="flex-1 p-4 space-y-4 overflow-hidden">
        {[48, 56, 40, 64, 48].map((w, i) => (
          <div
            key={i}
            className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}
          >
            <Skeleton
              className={`h-10 rounded-2xl`}
              style={{ width: `${w * 3}px` }}
            />
          </div>
        ))}
      </div>
    );
  }

  if (messages.length === 0) {
    return (
      <div className="motion-appear flex flex-1 items-center justify-center">
        <p className="text-sm text-muted-foreground">
          No messages yet. Send the first one below.
        </p>
      </div>
    );
  }

  // Group messages by date
  const grouped: { date: string; messages: Message[] }[] = [];
  for (const msg of messages) {
    const dateKey = new Date(msg.createdAt).toDateString();
    const last = grouped[grouped.length - 1];
    if (last && last.date === dateKey) {
      last.messages.push(msg);
    } else {
      grouped.push({ date: dateKey, messages: [msg] });
    }
  }

  return (
    <ScrollArea className="flex-1">
      <div ref={groupsRef} className="flex flex-col gap-3 px-4 py-4">
        {grouped.map((group) => (
          <div key={group.date} className="flex flex-col gap-3">
            {/* Date separator */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border" />
              <span className="text-[10px] font-medium text-muted-foreground px-2 shrink-0">
                {formatDateSeparator(group.messages[0].createdAt)}
              </span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {group.messages.map((msg) => (
              <MessageBubble
                key={msg.id}
                message={msg}
                // The sent message and the server's copy of it have different
                // ids, so the copy that replaces an optimistic one would arrive a
                // second time; it is left still, since it looks identical.
                arrive={
                  fresh.has(msg.id) &&
                  (msg.direction === "inbound" || msg.id.startsWith("optimistic-"))
                }
              />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
