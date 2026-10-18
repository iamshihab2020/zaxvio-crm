"use client";

export function ChatbotTypingIndicator() {
  return (
    <div className="motion-arrive flex items-start gap-2 px-4 py-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted">
        <span className="text-xs">🤖</span>
      </div>
      {/* A reply is pending, so this is a signal and may loop. It fades in
          sequence rather than bouncing (`.motion-dot` in globals.css): no
          spatial movement, and it reads the same with reduced motion on. */}
      <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md bg-muted px-4 py-3">
        <span
          className="motion-dot inline-block h-2.5 w-2.5 rounded-full bg-brand/60"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="motion-dot inline-block h-2.5 w-2.5 rounded-full bg-brand/60"
          style={{ animationDelay: "200ms" }}
        />
        <span
          className="motion-dot inline-block h-2.5 w-2.5 rounded-full bg-brand/60"
          style={{ animationDelay: "400ms" }}
        />
      </div>
    </div>
  );
}
