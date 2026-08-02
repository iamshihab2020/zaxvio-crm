import { IconShieldCheck } from "@tabler/icons-react";

/**
 * The licence credential, shown only when the tenant actually has one.
 *
 * Three customer-facing pages — the quote portal, the booking form and the
 * booking status page — printed a hardcoded "Licensed & Insured" badge for
 * every tenant. `tenants.license_number` has existed the whole time; the badge
 * simply never read it. Asserting someone else's credential is not ours to do,
 * and "Licensed & Insured" also claims insurance the product has never stored.
 *
 * Now it states the verifiable fact and nothing more: the licence number the
 * business entered. No number, no badge.
 */
export function LicenseBadge({
  licenseNumber,
  tone = "dark",
}: {
  licenseNumber?: string | null;
  /** `dark` sits on the branded header band; `light` on a paper background. */
  tone?: "dark" | "light";
}) {
  const value = licenseNumber?.trim();
  if (!value) return null;

  const styles =
    tone === "dark"
      ? "bg-white/10 text-white/85 dark:bg-muted/50 dark:text-muted-foreground"
      : "border border-brand/25 bg-brand-light text-ink";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 ${styles}`}
    >
      <IconShieldCheck className="h-3.5 w-3.5" aria-hidden />
      <span className="font-mono text-[11px] uppercase tracking-[0.14em]">
        Lic. {value}
      </span>
    </span>
  );
}
