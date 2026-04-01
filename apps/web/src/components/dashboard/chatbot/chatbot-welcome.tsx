"use client";

import { IconMessageChatbot } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";

interface ChatbotWelcomeProps {
  onSuggestionClick: (text: string) => void;
}

const SUGGESTIONS = [
  "How to create a job?",
  "Create a customer",
  "Schedule an event",
  "How to send an invoice?",
  "Add a catalog item",
  "What can you do?",
];

export function ChatbotWelcome({ onSuggestionClick }: ChatbotWelcomeProps) {
  return (
    <div
      className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-8"
      style={{ animation: "chatFadeIn 0.4s ease-out" }}
    >
      <div
        className="flex h-14 w-14 items-center justify-center rounded-full bg-brand/10"
        style={{ animation: "chatPop 0.5s ease-out" }}
      >
        <IconMessageChatbot className="h-7 w-7 text-brand" />
      </div>
      <div className="text-center">
        <h3 className="font-heading text-base font-semibold text-foreground">
          How can I help?
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">
          Ask a question or tell me to create something
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        {SUGGESTIONS.map((suggestion, index) => (
          <Button
            key={suggestion}
            variant="outline"
            size="sm"
            className="h-auto rounded-full px-3 py-1.5 text-xs transition-transform hover:scale-105"
            style={{
              animation: `chatFadeIn 0.3s ease-out ${index * 0.06}s both`,
            }}
            onClick={() => onSuggestionClick(suggestion)}
          >
            {suggestion}
          </Button>
        ))}
      </div>
    </div>
  );
}
