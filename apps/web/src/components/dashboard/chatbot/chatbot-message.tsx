"use client";

import { format } from "date-fns";
import { IconCheck, IconX } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import type { ChatMessage } from "@/lib/chatbot/types";

interface ChatbotMessageProps {
  message: ChatMessage;
  onConfirm?: () => void;
  onCancel?: () => void;
  onSelectCustomer?: (index: number) => void;
}

export function ChatbotMessage({
  message,
  onConfirm,
  onCancel,
  onSelectCustomer,
}: ChatbotMessageProps) {
  const isUser = message.role === "user";
  const time = format(new Date(message.timestamp), "h:mm a");

  return (
    <div
      className={`flex w-full ${isUser ? "justify-end" : "justify-start"} px-4 py-1.5`}
      style={{
        animation: isUser
          ? "chatSlideRight 0.3s ease-out"
          : "chatSlideLeft 0.3s ease-out",
      }}
    >
      <div
        className={`flex max-w-[85%] flex-col gap-1 ${isUser ? "items-end" : "items-start"}`}
      >
        <div className={`flex items-end gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
          {!isUser && (
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
              <span className="text-xs">🤖</span>
            </div>
          )}
          <div
            className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
              isUser
                ? "rounded-br-md bg-brand text-brand-foreground"
                : "rounded-bl-md bg-muted text-foreground"
            }`}
          >
            <MessageContent
              message={message}
              onConfirm={onConfirm}
              onCancel={onCancel}
              onSelectCustomer={onSelectCustomer}
            />
          </div>
        </div>
        <span
          className={`px-2 text-[10px] text-muted-foreground ${isUser ? "text-right" : "text-left"}`}
        >
          {time}
        </span>
      </div>
    </div>
  );
}

function MessageContent({
  message,
  onConfirm,
  onCancel,
  onSelectCustomer,
}: ChatbotMessageProps) {
  // Render markdown-like bold text
  const renderText = (text: string) => {
    const parts = text.split(/(\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      // Handle newlines
      return part.split("\n").map((line, j) => (
        <span key={`${i}-${j}`}>
          {j > 0 && <br />}
          {line}
        </span>
      ));
    });
  };

  switch (message.type) {
    case "action-confirm":
      return (
        <div className="flex flex-col gap-3">
          <div>{renderText(message.content)}</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              className="h-8 bg-brand text-brand-foreground transition-transform hover:scale-105 hover:bg-brand/90"
              onClick={onConfirm}
            >
              <IconCheck className="mr-1 h-3.5 w-3.5" />
              Confirm
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 transition-transform hover:scale-105"
              onClick={onCancel}
            >
              <IconX className="mr-1 h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      );

    case "action-result":
      return (
        <div
          className="flex items-start gap-2"
          style={{
            animation: message.content.startsWith("✓")
              ? "chatPop 0.3s ease-out"
              : "chatShake 0.4s ease-out",
          }}
        >
          {message.content.startsWith("✓") ? (
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
          ) : (
            <IconX className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          )}
          <span>{renderText(message.content)}</span>
        </div>
      );

    case "customer-select":
      return (
        <div className="flex flex-col gap-2">
          <div>{renderText(message.content)}</div>
          {message.actionData?.customerResults?.map((customer, idx) => (
            <Button
              key={customer.id}
              variant="outline"
              size="sm"
              className="h-auto justify-start px-3 py-2 text-left"
              onClick={() => onSelectCustomer?.(idx + 1)}
            >
              <span className="mr-2 font-mono text-xs text-muted-foreground">
                {idx + 1}.
              </span>
              <span>
                {customer.firstName} {customer.lastName}
                {customer.email && (
                  <span className="ml-2 text-xs text-muted-foreground">
                    {customer.email}
                  </span>
                )}
              </span>
            </Button>
          ))}
        </div>
      );

    case "field-prompt":
    case "text":
    default:
      return <>{renderText(message.content)}</>;
  }
}
