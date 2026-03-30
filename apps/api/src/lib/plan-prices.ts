/**
 * Plan pricing map — single source of truth for MRR calculations.
 * Maps plan_name from tenant_subscriptions to monthly price in USD.
 */
export const PLAN_PRICES: Record<string, number> = {
  starter: 49,
  pro: 99,
  enterprise: 199,
};

/**
 * Get the monthly price for a plan name.
 * Returns 0 for unknown plans.
 */
export function getPlanPrice(planName: string | null): number {
  if (!planName) return 0;
  return PLAN_PRICES[planName.toLowerCase()] ?? 0;
}
