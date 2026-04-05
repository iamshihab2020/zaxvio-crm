"use client";

import { useRef } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { IconSend, IconMail, IconMessage, IconChevronDown } from "@tabler/icons-react";

interface ComposeBarProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  isSending: boolean;
  channel: "sms" | "email";
}

export function ComposeBar({
  value,
  onChange,
  onSend,
  isSending,
  channel,
}: ComposeBarProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (value.trim() && !isSending) {
        onSend();
      }
    }
  }

  // Auto-resize textarea
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    onChange(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 120)}px`;
  }

  return (
    <div className="border-t border-border px-4 py-3 shrink-0 bg-card">
      <div className="flex items-end gap-2">
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={`Type a message… (Ctrl+Enter to send)`}
          className="resize-none flex-1 min-h-[36px] max-h-[120px] overflow-y-auto leading-relaxed text-sm"
          rows={1}
          disabled={isSending}
        />

        {/* Channel selector */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 shrink-0"
            >
              {channel === "email" ? (
                <IconMail className="h-3.5 w-3.5" />
              ) : (
                <IconMessage className="h-3.5 w-3.5" />
              )}
              <span className="text-xs">
                {channel === "email" ? "Email" : "SMS"}
              </span>
              <IconChevronDown className="h-3 w-3 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-44 p-1" sideOffset={4}>
            <button className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md hover:bg-muted cursor-pointer transition-colors duration-150">
              <span>Email</span>
              <IconMail className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
            <button
              disabled
              className="w-full flex items-center justify-between px-2 py-1.5 text-sm rounded-md opacity-50 cursor-not-allowed"
            >
              <span>SMS</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                Coming Soon
              </Badge>
            </button>
          </PopoverContent>
        </Popover>

        {/* Send button */}
        <Button
          size="sm"
          className="h-9 px-3 shrink-0 gap-1.5"
          onClick={onSend}
          disabled={!value.trim() || isSending}
        >
          <IconSend className="h-3.5 w-3.5" />
          <span className="text-xs">Send</span>
        </Button>
      </div>

      <p className="text-[10px] text-muted-foreground mt-1.5">
        Press Ctrl+Enter to send
      </p>
    </div>
  );
}
