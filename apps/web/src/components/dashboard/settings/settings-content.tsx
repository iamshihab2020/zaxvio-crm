/**
 * The padded area every settings page renders into. It does not animate: the
 * shell's route arrival (`useRouteArrival`) already runs on navigation, and each
 * page marks its own stack with `data-stagger` so its cards arrive in turn.
 */
export function SettingsContent({ children }: { children: React.ReactNode }) {
  return <div className="p-4 sm:p-6">{children}</div>;
}
