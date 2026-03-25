import { IconCheck, IconAlertTriangle } from "@tabler/icons-react";

interface SettingsFormMessageProps {
  message: { type: "success" | "error"; text: string } | null;
}

export function SettingsFormMessage({ message }: SettingsFormMessageProps) {
  if (!message) return null;

  return (
    <div
      className={`flex items-start gap-2 rounded-md border px-4 py-3 text-sm font-body ${
        message.type === "success"
          ? "border-green-200 bg-green-50 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-300"
          : "border-destructive/50 bg-destructive/10 text-destructive dark:border-destructive/30 dark:bg-destructive/10 dark:text-destructive"
      }`}
    >
      {message.type === "success" ? (
        <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
      ) : (
        <IconAlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      )}
      <span>{message.text}</span>
    </div>
  );
}
