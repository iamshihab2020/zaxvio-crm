interface SettingsPageHeaderProps {
  description: string;
  action?: React.ReactNode;
}

export function SettingsPageHeader({
  description,
  action,
}: SettingsPageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <p className="text-sm text-muted-foreground font-body">{description}</p>
      {action}
    </div>
  );
}
