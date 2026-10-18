"use client";

import { useState, useEffect } from "react";
import { IconMessageChatbot } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { useChatbot } from "@/hooks/use-chatbot";
import { onOpenChatbot } from "@/lib/chatbot/bus";
import { DUR } from "@/lib/motion";
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

  useEffect(() => onOpenChatbot(() => setIsOpen(true)), [setIsOpen]);

  // The panel is not a Radix overlay, so nothing keeps it mounted while it
  // leaves. `panelMounted` does: it turns on with `isOpen` and off one exit
  // later, which lets the closing animation play before the unmount. Reopening
  // inside that window cancels the unmount and the entrance simply restarts.
  const [panelMounted, setPanelMounted] = useState(false);
  if (isOpen && !panelMounted) setPanelMounted(true);
  useEffect(() => {
    if (isOpen || !panelMounted) return;
    const timer = setTimeout(() => setPanelMounted(false), DUR.exit);
    return () => clearTimeout(timer);
  }, [isOpen, panelMounted]);

  return (
    <>
      {/* Keyframes for the panel and the launcher. Everything inside the panel
          (messages, results, the welcome screen) uses the shared `motion-*`
          classes from globals.css instead. */}
      <style jsx global>{`
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
        @keyframes chatPanelOut {
          from {
            transform-origin: bottom right;
          }
          to {
            opacity: 0;
            transform: translateY(8px) scale(0.97);
            transform-origin: bottom right;
          }
        }

        /* Reduced motion. These animations are set inline by name, which a
           stylesheet cannot override, so the KEYFRAMES are redefined instead:
           a later @keyframes of the same name wins while the query matches.
           The panel keeps its fade and loses the rise and scale; the pulse
           loses its movement entirely, because the button already carries the
           state. */
        @media (prefers-reduced-motion: reduce) {
          @keyframes chatPanelIn {
            from {
              opacity: 0;
            }
          }
          @keyframes chatPanelOut {
            to {
              opacity: 0;
            }
          }
          @keyframes chatPulse {
            from {
              opacity: 1;
            }
          }
        }
      `}</style>

      {/* Chat Panel */}
      {panelMounted && (
        <div
          className={`fixed bottom-20 right-6 z-40 max-sm:inset-4 max-sm:bottom-4 max-sm:right-4 sm:h-[520px] sm:w-[380px] ${
            isOpen ? "" : "pointer-events-none"
          }`}
          // Entrance on the system curve over `arrive`. The exit is quicker and
          // holds its last frame (`forwards`) until the unmount that follows.
          style={{
            animation: isOpen
              ? "chatPanelIn var(--dur-arrive) var(--ease-out)"
              : "chatPanelOut var(--dur-exit) var(--ease-out) forwards",
          }}
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
        className={`fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-brand text-brand-foreground shadow-lg transition-[transform,box-shadow,background-color] duration-200 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)] motion-reduce:transition-none hover:bg-brand/90 hover:shadow-xl ${
          isOpen ? "rotate-90 scale-90" : "scale-100"
        }`}
        // Three pulses, then rest. `hasOpened` is not persisted, so this used to
        // loop forever on every dashboard page load until the assistant was
        // opened, a screen that never went still (DESIGN.md). Three is enough to
        // be noticed.
        style={
          !hasOpened && !isOpen
            ? { animation: "chatPulse 2s ease-in-out 3" }
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
