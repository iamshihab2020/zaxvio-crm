import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ElementType;
  title: string;
  description: string;
  subtitle?: string;
  actionLabel: string;
  onAction: () => void;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  subtitle,
  actionLabel,
  onAction,
}: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand-light">
        <Icon className="h-8 w-8 text-brand" />
      </div>
      <h3 className="mt-4 font-heading text-lg font-semibold text-foreground">
        {title}
      </h3>
      <p className="mt-1 max-w-sm text-center text-sm text-muted-foreground font-body">
        {description}
      </p>
      {subtitle && (
        <p className="mt-1 text-xs text-muted-foreground/70 font-body">
          {subtitle}
        </p>
      )}
      <Button
        onClick={onAction}
        className="mt-4 bg-brand text-brand-foreground hover:bg-brand/90"
      >
        {actionLabel}
      </Button>
    </div>
  );
}
