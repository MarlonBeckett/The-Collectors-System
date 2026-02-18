import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/admin';

export const runtime = 'nodejs';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const supabase = createAdminClient();

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;

        if (session.mode !== 'subscription') break;

        const userId = session.metadata?.user_id;
        if (!userId) {
          console.error('No user_id in checkout session metadata');
          break;
        }

        const subscription = await stripe.subscriptions.retrieve(
          session.subscription as string
        );

        const subscriptionItem = subscription.items.data[0];
        const priceId = subscriptionItem?.price.id;
        const plan = priceId === process.env.STRIPE_MONTHLY_PRICE_ID ? 'monthly' : 'annual';
        const currentPeriodEnd = subscriptionItem?.current_period_end;

        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: session.customer as string,
            stripe_subscription_id: subscription.id,
            status: 'active',
            plan,
            current_period_end: currentPeriodEnd ? new Date(currentPeriodEnd * 1000).toISOString() : null,
            cancel_at_period_end: subscription.cancel_at_period_end,
          }, { onConflict: 'user_id' });

        // Promote viewer→editor where intended_role='editor'
        await supabase
          .from('collection_members')
          .update({ role: 'editor', intended_role: null })
          .eq('user_id', userId)
          .eq('role', 'viewer')
          .eq('intended_role', 'editor');

        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;

        const { data: existingSub } = await supabase
          .from('subscriptions')
          .select('user_id, cancel_at_period_end')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        if (!existingSub) {
          console.error('No subscription found for:', subscription.id);
          break;
        }

        let status: 'active' | 'canceled' | 'past_due' = 'active';
        if (subscription.status === 'canceled') {
          status = 'canceled';
        } else if (subscription.status === 'past_due') {
          status = 'past_due';
        }

        const itemPeriodEnd = subscription.items.data[0]?.current_period_end;

        // Only update cancel_at_period_end if:
        // 1. Stripe says it's true (user cancelled), OR
        // 2. It's currently false in our DB (safe to update either way)
        // This prevents race conditions where multiple webhook events overwrite cancellation
        const shouldUpdateCancelFlag = subscription.cancel_at_period_end || !existingSub.cancel_at_period_end;

        await supabase
          .from('subscriptions')
          .update({
            status,
            current_period_end: itemPeriodEnd ? new Date(itemPeriodEnd * 1000).toISOString() : null,
            ...(shouldUpdateCancelFlag && { cancel_at_period_end: subscription.cancel_at_period_end }),
          })
          .eq('stripe_subscription_id', subscription.id);

        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;

        // Fetch user_id before nulling stripe_subscription_id
        const { data: deletedSub } = await supabase
          .from('subscriptions')
          .select('user_id')
          .eq('stripe_subscription_id', subscription.id)
          .single();

        await supabase
          .from('subscriptions')
          .update({
            status: 'canceled',
            stripe_subscription_id: null,
            cancel_at_period_end: false,
          })
          .eq('stripe_subscription_id', subscription.id);

        // Demote editors to viewers with intended_role
        if (deletedSub?.user_id) {
          await supabase
            .from('collection_members')
            .update({ role: 'viewer', intended_role: 'editor' })
            .eq('user_id', deletedSub.user_id)
            .eq('role', 'editor');
        }

        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        // Get subscription ID from parent.subscription_details
        const subscriptionDetails = invoice.parent?.subscription_details;
        const subscriptionId = typeof subscriptionDetails?.subscription === 'string'
          ? subscriptionDetails.subscription
          : subscriptionDetails?.subscription?.id;

        if (subscriptionId) {
          await supabase
            .from('subscriptions')
            .update({ status: 'past_due' })
            .eq('stripe_subscription_id', subscriptionId);
        }

        break;
      }
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error('Webhook handler error:', err);
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 });
  }
}
