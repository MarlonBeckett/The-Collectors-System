// Constants and types that can be used in both client and server components
export const FREE_VEHICLE_LIMIT = 3;

export type SubscriptionStatus = 'free' | 'active' | 'canceled' | 'past_due';
export type SubscriptionPlan = 'monthly' | 'annual';

export interface Subscription {
  id: string;
  user_id: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  status: SubscriptionStatus;
  plan: SubscriptionPlan | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Checks if a subscription has Pro access (active subscription).
 */
export function isPro(subscription: Subscription | null): boolean {
  if (!subscription) return false;
  return subscription.status === 'active';
}

/**
 * Gets the vehicle limit for a subscription.
 */
export function getVehicleLimit(subscription: Subscription | null): number {
  return isPro(subscription) ? Infinity : FREE_VEHICLE_LIMIT;
}

/**
 * Checks if user can add more vehicles.
 */
export function canAddVehicles(
  subscription: Subscription | null,
  currentCount: number,
  addCount: number = 1
): boolean {
  const limit = getVehicleLimit(subscription);
  return currentCount + addCount <= limit;
}
