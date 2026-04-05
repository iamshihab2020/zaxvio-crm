import { IconMessageCircle } from "@tabler/icons-react";

export function ConversationEmpty() {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center p-8">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted">
        <IconMessageCircle className="h-8 w-8 text-muted-foreground" stroke={1.5} />
      </div>
      <div className="space-y-1">
        <p className="font-heading text-base font-semibold text-foreground">
          No conversation selected
        </p>
        <p className="text-sm text-muted-foreground max-w-xs">
          Choose a conversation from the list or start a new one to begin messaging your customers.
        </p>
      </div>
    </div>
  );
}
