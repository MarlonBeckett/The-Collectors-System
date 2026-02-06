'use client';

import { useState } from 'react';
import type { Subscription } from '@/lib/subscription';
import { isPro, FREE_VEHICLE_LIMIT } from '@/lib/subscription';

interface SubscriptionSettingsProps {
  subscription: Subscription | null;
  vehicleCount: number;
}

export default function SubscriptionSettings({
  subscription,
  vehicleCount,
}: SubscriptionSettingsProps) {
  const [loading, setLoading] = useState<'monthly' | 'annual' | null>(null);

  const isProUser = isPro(subscription);
  const vehicleLimit = isProUser ? 'Unlimited' : FREE_VEHICLE_LIMIT;

  const handleUpgrade = async (plan: 'monthly' | 'annual') => {
    setLoading(plan);
    try {
      const priceId =
        plan === 'monthly'
          ? process.env.NEXT_PUBLIC_STRIPE_MONTHLY_PRICE_ID
          : process.env.NEXT_PUBLIC_STRIPE_ANNUAL_PRICE_ID;

      if (!priceId) {
        console.error('Stripe price ID not configured for', plan);
        alert('Payment is not configured yet. Please try again later.');
        return;
      }

      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priceId }),
      });

      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        console.error('Checkout error:', data.error);
        alert('Failed to start checkout. Please try again.');
      }
    } catch (err) {
      console.error('Upgrade error:', err);
      alert('Failed to start checkout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-4" id="subscription">
      <h2 className="text-lg font-medium">Subscription</h2>

      {/* Status warnings */}
      {subscription?.status === 'past_due' && (
        <div className="bg-yellow-500/10 p-4 border border-yellow-500/30">
          <p className="text-sm text-yellow-500">
            Your payment is past due. Please update your payment method to
            continue your Pro subscription.
          </p>
        </div>
      )}

      {subscription?.cancel_at_period_end && subscription.status === 'active' && (
        <div className="bg-orange-500/10 p-4 border border-orange-500/30">
          <p className="text-sm text-orange-500">
            Your subscription will be canceled on{' '}
            {formatDate(subscription.current_period_end)}. You&apos;ll keep Pro
            features until then.
          </p>
        </div>
      )}

      <div className="bg-card border border-border p-6">
        {/* Current plan info */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm text-muted-foreground">Current Plan</p>
            <p className="text-xl font-semibold text-foreground">
              {isProUser
                ? `Pro ${subscription?.plan === 'annual' ? '(Annual)' : '(Monthly)'}`
                : 'Free'}
            </p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Vehicles</p>
            <p className="text-xl font-semibold text-foreground">
              {vehicleCount} / {vehicleLimit}
            </p>
          </div>
        </div>

        {isProUser ? (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-1">Next billing date</p>
            <p className="font-medium text-foreground">
              {formatDate(subscription?.current_period_end ?? null)}
            </p>
            <p className="text-xs text-muted-foreground mt-2">
              Manage your subscription in the Danger Zone below
            </p>
          </div>
        ) : (
          <div className="border-t border-border pt-4 mt-4">
            <p className="text-sm text-muted-foreground mb-4">
              Upgrade to Pro for unlimited vehicles
            </p>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => handleUpgrade('monthly')}
                disabled={loading !== null}
                className="border border-border px-4 py-3 text-sm font-medium hover:bg-muted disabled:opacity-50"
              >
                {loading === 'monthly' ? (
                  'Loading...'
                ) : (
                  <>
                    <span className="block text-lg font-semibold text-foreground">$5/mo</span>
                    <span className="text-muted-foreground">Monthly</span>
                  </>
                )}
              </button>

              <button
                onClick={() => handleUpgrade('annual')}
                disabled={loading !== null}
                className="bg-primary text-primary-foreground px-4 py-3 text-sm font-medium hover:opacity-90 disabled:opacity-50 relative"
              >
                {loading === 'annual' ? (
                  'Loading...'
                ) : (
                  <>
                    <span className="absolute -top-2 -right-2 bg-green-500 text-white text-xs px-2 py-0.5 rounded-full">
                      Save 33%
                    </span>
                    <span className="block text-lg font-semibold">$40/yr</span>
                    <span className="text-primary-foreground/70">Annual</span>
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
