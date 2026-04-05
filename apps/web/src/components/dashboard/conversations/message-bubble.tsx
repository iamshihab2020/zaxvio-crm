import { Badge } from "@/components/ui/badge";
import { IconMail, IconMessage } from "@tabler/icons-react";
import type { Message } from "@/actions/conversations";

interface MessageBubbleProps {
  message: Message;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isOutbound = message.direction === "outbound";

  return (
    <div className={`flex flex-col gap-1 ${isOutbound ? "items-end" : "items-start"}`}>
      <div
        className={`max-w-[75%] px-4 py-2.5 text-sm leading-relaxed ${
          isOutbound
            ? "ml-auto bg-brand text-brand-foreground rounded-2xl rounded-br-sm"
            : "mr-auto bg-muted text-foreground rounded-2xl rounded-bl-sm"
        }`}
      >
        {message.body}
      </div>
      <div className={`flex items-center gap-1.5 ${isOutbound ? "flex-row-reverse" : "flex-row"}`}>
        <span className="text-[10px] text-muted-foreground">
          {formatTime(message.createdAt)}
        </span>
        <Badge
          variant="outline"
          className="text-[10px] px-1.5 py-0 h-4 gap-0.5 border-muted-foreground/30"
        >
          {message.channel === "email" ? (
            <IconMail className="h-2.5 w-2.5" />
          ) : (
            <IconMessage className="h-2.5 w-2.5" />
          )}
          {message.channel === "email" ? "Email" : "SMS"}
        </Badge>
      </div>
    </div>
  );
}
