"use client";

import { useEffect, useRef } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageBubble } from "./message-bubble";
import { Skeleton } from "@/components/ui/skeleton";
import type { Message } from "@/actions/conversations";

interface ConversationThreadProps {
  messages: Message[];
  isLoading: boolean;
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

export function ConversationThread({ messages, isLoading }: ConversationThreadProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

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
      <div className="flex flex-1 items-center justify-center">
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
      <div className="flex flex-col gap-3 px-4 py-4">
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
              <MessageBubble key={msg.id} message={msg} />
            ))}
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  );
}
