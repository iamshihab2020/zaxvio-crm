"use client";

import { useState, useEffect } from "react";
import { IconMessageChatbot } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useChatbot } from "@/hooks/use-chatbot";
import { ChatbotPanel } from "./chatbot-panel";

export function HelpChatbot() {
  const {
    messages,
    isOpen,
    isProcessing,
    setIsOpen,
    sendMessage,
    confirmAction,
    cancelAction,
    selectCustomer,
    clearHistory,
  } = useChatbot();

  const [hasOpened, setHasOpened] = useState(false);

  useEffect(() => {
    if (isOpen && !hasOpened) {
      setHasOpened(true);
    }
  }, [isOpen, hasOpened]);

  return (
    <>
      {/* CSS Keyframes for animations */}
      <style jsx global>{`
        @keyframes chatSlideLeft {
          from {
            opacity: 0;
            transform: translateX(-12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes chatSlideRight {
          from {
            opacity: 0;
            transform: translateX(12px);
          }
          to {
            opacity: 1;
            transform: translateX(0);
          }
        }
        @keyframes chatFadeIn {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        @keyframes chatPop {
          0% {
            transform: scale(0.8);
            opacity: 0;
          }
          60% {
            transform: scale(1.05);
            opacity: 1;
          }
          100% {
            transform: scale(1);
          }
        }
        @keyframes chatShake {
          0%,
          100% {
            transform: translateX(0);
          }
          15% {
            transform: translateX(-4px);
          }
          30% {
            transform: translateX(4px);
          }
          45% {
            transform: translateX(-3px);
          }
          60% {
            transform: translateX(3px);
          }
          75% {
            transform: translateX(-1px);
          }
        }
        @keyframes chatPulse {
          0%,
          100% {
            box-shadow:
              0 0 0 0 hsl(var(--brand) / 0.4),
              0 10px 15px -3px rgba(0, 0, 0, 0.1);
          }
          50% {
            box-shadow:
              0 0 0 8px hsl(var(--brand) / 0),
              0 10px 15px -3px rgba(0, 0, 0, 0.1);
          }
        }
        @keyframes chatPanelIn {
          from {
            opacity: 0;
            transform: translateY(16px) scale(0.95);
            transform-origin: bottom right;
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>

      {/* Chat Panel */}
      {isOpen && (
        <div
          className="fixed bottom-20 right-6 z-40 max-sm:inset-4 max-sm:bottom-4 max-sm:right-4 sm:h-[520px] sm:w-[380px]"
          style={{ animation: "chatPanelIn 0.3s ease-out" }}
        >
          <ChatbotPanel
            messages={messages}
            isProcessing={isProcessing}
            onSendMessage={sendMessage}
            onConfirm={confirmAction}
            onCancel={cancelAction}
            onSelectCustomer={selectCustomer}
            onClearHistory={clearHistory}
            onClose={() => setIsOpen(false)}
          />
        </div>
      )}

      {/* Floating Button */}
      <Button
        onClick={() => setIsOpen(!isOpen)}
        className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-brand text-brand-foreground shadow-lg transition-all duration-300 hover:bg-brand/90 hover:shadow-xl ${
          isOpen ? "rotate-90 scale-90" : "scale-100"
        }`}
        style={
          !hasOpened && !isOpen
            ? { animation: "chatPulse 2s ease-in-out infinite" }
            : undefined
        }
        size="icon"
      >
        {isOpen ? (
          <span className="text-xl font-light">✕</span>
        ) : (
          <IconMessageChatbot className="h-6 w-6" />
        )}
      </Button>
    </>
  );
}
