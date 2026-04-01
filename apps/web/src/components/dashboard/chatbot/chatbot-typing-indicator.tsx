"use client";

export function ChatbotTypingIndicator() {
  return (
    <div
      className="flex items-start gap-2 px-4 py-2"
      style={{ animation: "chatSlideLeft 0.3s ease-out" }}
    >
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <span className="text-xs">🤖</span>
      </div>
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <span
          className="inline-block h-2.5 w-2.5 animate-bounce rounded-full bg-brand/40"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="inline-block h-2.5 w-2.5 animate-bounce rounded-full bg-brand/40"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="inline-block h-2.5 w-2.5 animate-bounce rounded-full bg-brand/40"
          style={{ animationDelay: "300ms" }}
        />
      </div>
    </div>
  );
}
