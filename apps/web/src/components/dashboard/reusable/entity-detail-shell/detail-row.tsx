import type { ReactNode, ElementType } from "react";

interface DetailRowProps {
  icon: ElementType;
  label: string;
  children: ReactNode;
}

export function DetailRow({ icon: Icon, label, children }: DetailRowProps) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground font-body">{label}</p>
        <div className="text-sm font-medium text-foreground font-body">
          {children}
        </div>
      </div>
    </div>
  );
}
