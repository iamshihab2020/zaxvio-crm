"use client";

import { useState, useRef, useEffect } from "react";
import { IconSend, IconX, IconTrash } from "@tabler/icons-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ChatMessage } from "@/lib/chatbot/types";
import { ChatbotMessage } from "./chatbot-message";
import { ChatbotTypingIndicator } from "./chatbot-typing-indicator";
import { ChatbotWelcome } from "./chatbot-welcome";

interface ChatbotPanelProps {
  messages: ChatMessage[];
  isProcessing: boolean;
  onSendMessage: (text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  onSelectCustomer: (index: number) => void;
  onClearHistory: () => void;
  onClose: () => void;
}

export function ChatbotPanel({
  messages,
  isProcessing,
  onSendMessage,
  onConfirm,
  onCancel,
  onSelectCustomer,
  onClearHistory,
  onClose,
}: ChatbotPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isProcessing]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = input.trim();
    if (!trimmed || isProcessing) return;
    onSendMessage(trimmed);
    setInput("");
  };

  const handleSuggestionClick = (text: string) => {
    onSendMessage(text);
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between bg-brand px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🤖</span>
          <h3 className="font-heading text-sm font-semibold text-brand-foreground">
            Help Assistant
          </h3>
        </div>
        <div className="flex items-center gap-1">
          <TooltipProvider delayDuration={300}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-brand-foreground/80 hover:bg-brand-foreground/10 hover:text-brand-foreground"
                  onClick={onClearHistory}
                >
                  <IconTrash className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="bottom">Clear history</TooltipContent>
            </Tooltip>
          </TooltipProvider>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-brand-foreground/80 hover:bg-brand-foreground/10 hover:text-brand-foreground"
            onClick={onClose}
          >
            <IconX className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="flex min-h-full flex-col">
          {messages.length === 0 ? (
            <ChatbotWelcome onSuggestionClick={handleSuggestionClick} />
          ) : (
            <div className="flex flex-col py-3">
              {messages.map((msg) => (
                <ChatbotMessage
                  key={msg.id}
                  message={msg}
                  onConfirm={onConfirm}
                  onCancel={onCancel}
                  onSelectCustomer={onSelectCustomer}
                />
              ))}
              {isProcessing && <ChatbotTypingIndicator />}
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input */}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-2 border-t border-border px-3 py-3"
      >
        <Input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={
            isProcessing ? "Processing..." : "Ask a question or create something..."
          }
          disabled={isProcessing}
          className="h-9 flex-1 text-sm"
        />
        <Button
          type="submit"
          size="icon"
          disabled={!input.trim() || isProcessing}
          className="h-9 w-9 shrink-0 bg-brand text-brand-foreground hover:bg-brand/90"
        >
          <IconSend className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
}
