"use client";

const OPEN_EVENT = "chatbot:open";

export function openChatbot() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(OPEN_EVENT));
}

export function onOpenChatbot(handler: () => void) {
  if (typeof window === "undefined") return () => {};
  const listener = () => handler();
  window.addEventListener(OPEN_EVENT, listener);
  return () => window.removeEventListener(OPEN_EVENT, listener);
}
