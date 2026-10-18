import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface SettingsSectionProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  /**
   * True while the section has just been saved: a brand wash that settles into
   * the card's own colour (`motion-highlight`). The caller holds it for a moment
   * (`useRowFlash`) and the class does nothing once the animation has played.
   */
  flash?: boolean;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  action,
  flash = false,
}: SettingsSectionProps) {
  return (
    // 16px of padding on a phone, 24px from `sm` (DESIGN.md, Rhythm): the card
    // already sits in a 16px page gutter, and 24px more on each side left a
    // 295px column for a form that needs every pixel of it.
    <Card className={cn(flash && "motion-highlight")}>
      <CardHeader className="p-4 sm:p-6">
        {/* Wraps so a long title and its action never squeeze each other. */}
        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-2">
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-brand" />}
            <CardTitle className="font-heading text-base font-semibold">
              {title}
            </CardTitle>
          </div>
          {action}
        </div>
        {description && (
          <CardDescription className="font-body text-sm text-muted-foreground">
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}
