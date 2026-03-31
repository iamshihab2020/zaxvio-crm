import { Button } from "@/components/ui/button";

interface NotificationHeaderProps {
  unreadCount: number;
  onMarkAllRead: () => void;
}

export function NotificationHeader({
  unreadCount,
  onMarkAllRead,
}: NotificationHeaderProps) {
  return (
    <div className="flex items-center justify-between px-3 py-2.5">
      <h3 className="font-heading text-sm font-semibold text-foreground">
        Notifications
      </h3>
      <Button
        variant="ghost"
        size="sm"
        className="h-auto px-2 py-1 text-xs text-muted-foreground hover:text-foreground"
        disabled={unreadCount === 0}
        onClick={onMarkAllRead}
      >
        Mark all as read
      </Button>
    </div>
  );
}
