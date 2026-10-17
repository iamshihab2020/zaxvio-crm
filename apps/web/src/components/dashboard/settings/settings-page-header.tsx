interface SettingsPageHeaderProps {
  description: string;
  action?: React.ReactNode;
}

export function SettingsPageHeader({
  description,
  action,
}: SettingsPageHeaderProps) {
  return (
    // Wraps so the action drops under a long description instead of squeezing it.
    <div className="mb-6 flex flex-wrap items-center justify-between gap-x-4 gap-y-3">
      <p className="text-sm text-muted-foreground font-body">{description}</p>
      {action}
    </div>
  );
}
