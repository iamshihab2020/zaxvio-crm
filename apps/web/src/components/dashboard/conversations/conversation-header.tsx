import Link from "next/link";
import { IconMail, IconMessage, IconExternalLink } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Conversation } from "@/actions/conversations";

interface ConversationHeaderProps {
  conversation: Conversation;
}

export function ConversationHeader({ conversation }: ConversationHeaderProps) {
  const name = `${conversation.customerFirstName} ${conversation.customerLastName}`;
  const contact =
    conversation.channel === "email"
      ? conversation.customerEmail
      : conversation.customerPhone;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card shrink-0">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-light text-sm font-semibold text-brand">
          {conversation.customerFirstName[0]}
          {conversation.customerLastName[0]}
        </div>
        <div className="min-w-0">
          <p className="font-heading text-sm font-semibold text-foreground truncate">
            {name}
          </p>
          <div className="flex items-center gap-1.5">
            {conversation.channel === "email" ? (
              <IconMail className="h-3 w-3 text-muted-foreground shrink-0" />
            ) : (
              <IconMessage className="h-3 w-3 text-muted-foreground shrink-0" />
            )}
            <span className="text-xs text-muted-foreground truncate">
              {contact ?? "—"}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <Badge variant="secondary" className="text-[11px]">
          {conversation.channel === "email" ? "Email" : "SMS"}
        </Badge>
        <Button variant="ghost" size="sm" asChild className="h-7 gap-1 text-xs">
          <Link href={`/customers/${conversation.customerId}`}>
            View Customer
            <IconExternalLink className="h-3 w-3" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
