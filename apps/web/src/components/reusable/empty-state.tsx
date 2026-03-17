import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16">
      <Icon className="h-12 w-12 text-muted-foreground" />
      <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1 text-sm text-muted-foreground font-body">
        {description}
      </p>
      <Button
        onClick={onAction}
        className="mt-4 bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
