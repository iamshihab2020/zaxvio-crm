"use client";

import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Conversation } from "@/actions/conversations";

interface ConversationItemProps {
  conversation: Conversation;
  isActive: boolean;
  onClick: () => void;
}

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d`;
  return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function ConversationItem({
  conversation,
  isActive,
  onClick,
}: ConversationItemProps) {
  const initials =
    (conversation.customerFirstName[0] ?? "") +
    (conversation.customerLastName[0] ?? "");
  const name = `${conversation.customerFirstName} ${conversation.customerLastName}`;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 px-3 py-3 text-left cursor-pointer",
        "transition-colors duration-150 border-l-2",
        "hover:bg-muted/50",
        isActive
          ? "bg-accent border-brand"
          : "border-transparent",
      )}
    >
      {/* Avatar */}
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
        {initials}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-sm text-foreground truncate">{name}</span>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {formatRelativeTime(conversation.lastMessageAt)}
          </span>
        </div>
        <p className="text-xs text-muted-foreground truncate mt-0.5">
          {conversation.subject ?? (conversation.channel === "email" ? "Email thread" : "SMS conversation")}
        </p>
      </div>

      {/* Unread badge */}
      {conversation.unreadCount > 0 && (
        <Badge
          variant="destructive"
          className="text-[10px] h-4 min-w-4 px-1 shrink-0"
        >
          {conversation.unreadCount > 9 ? "9+" : conversation.unreadCount}
        </Badge>
      )}
    </button>
  );
}
