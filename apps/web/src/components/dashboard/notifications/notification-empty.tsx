import { IconBellOff } from "@tabler/icons-react";

export function NotificationEmpty() {
  return (
    <div className="flex flex-col items-center justify-center py-10 px-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
        <IconBellOff className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="mt-3 font-heading text-sm font-medium text-foreground">
        No notifications
      </p>
      <p className="mt-1 text-xs text-muted-foreground font-body">
        You&apos;re all caught up
      </p>
    </div>
  );
}
