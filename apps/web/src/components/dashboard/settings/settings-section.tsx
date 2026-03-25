import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

interface SettingsSectionProps {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}

export function SettingsSection({
  icon: Icon,
  title,
  description,
  children,
  action,
}: SettingsSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
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
      <CardContent>{children}</CardContent>
    </Card>
  );
}
