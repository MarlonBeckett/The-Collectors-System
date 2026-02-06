import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2026-01-28.clover',
});

export async function POST() {
  const supabase = await createClient();
  const adminSupabase = createAdminClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // 1. Cancel any active Stripe subscription
    const { data: subscription } = await adminSupabase
      .from('subscriptions')
      .select('stripe_subscription_id, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    if (subscription?.stripe_subscription_id) {
      try {
        await stripe.subscriptions.cancel(subscription.stripe_subscription_id);
        console.log('Cancelled Stripe subscription:', subscription.stripe_subscription_id);
      } catch (stripeErr) {
        console.error('Failed to cancel Stripe subscription:', stripeErr);
        // Continue with deletion even if Stripe cancellation fails
      }
    }

    // Also delete the Stripe customer to clean up completely
    if (subscription?.stripe_customer_id) {
      try {
        await stripe.customers.del(subscription.stripe_customer_id);
        console.log('Deleted Stripe customer:', subscription.stripe_customer_id);
      } catch (stripeErr) {
        console.error('Failed to delete Stripe customer:', stripeErr);
        // Continue with deletion even if Stripe customer deletion fails
      }
    }

    // 2. Delete user's owned collections (cascades to vehicles, photos, etc.)
    const { data: ownedCollections } = await adminSupabase
      .from('collections')
      .select('id')
      .eq('owner_id', user.id);

    if (ownedCollections && ownedCollections.length > 0) {
      const collectionIds = ownedCollections.map(c => c.id);

      // Get vehicles in owned collections
      const { data: vehicles } = await adminSupabase
        .from('motorcycles')
        .select('id')
        .in('collection_id', collectionIds);

      if (vehicles && vehicles.length > 0) {
        const vehicleIds = vehicles.map(v => v.id);

        // Delete photos from storage
        const { data: photos } = await adminSupabase
          .from('photos')
          .select('storage_path')
          .in('motorcycle_id', vehicleIds);

        if (photos && photos.length > 0) {
          const paths = photos.map(p => p.storage_path);
          await adminSupabase.storage.from('motorcycle-photos').remove(paths);
        }

        // Delete service record receipts from storage
        const { data: serviceRecords } = await adminSupabase
          .from('service_records')
          .select('id')
          .in('motorcycle_id', vehicleIds);

        if (serviceRecords && serviceRecords.length > 0) {
          const recordIds = serviceRecords.map(r => r.id);
          const { data: receipts } = await adminSupabase
            .from('service_record_receipts')
            .select('storage_path')
            .in('service_record_id', recordIds);

          if (receipts && receipts.length > 0) {
            const receiptPaths = receipts.map(r => r.storage_path);
            await adminSupabase.storage.from('service-receipts').remove(receiptPaths);
          }
        }

        // Delete vehicle documents from storage
        const { data: documents } = await adminSupabase
          .from('vehicle_documents')
          .select('storage_path')
          .in('motorcycle_id', vehicleIds);

        if (documents && documents.length > 0) {
          const docPaths = documents.map(d => d.storage_path);
          await adminSupabase.storage.from('vehicle-documents').remove(docPaths);
        }
      }

      // Delete vehicles in owned collections (cascade will handle related records)
      await adminSupabase
        .from('motorcycles')
        .delete()
        .in('collection_id', collectionIds);

      // Delete owned collections
      await adminSupabase
        .from('collections')
        .delete()
        .eq('owner_id', user.id);
    }

    // 3. Remove user from any collections they've joined
    await adminSupabase
      .from('collection_members')
      .delete()
      .eq('user_id', user.id);

    // 4. Delete subscription record
    await adminSupabase
      .from('subscriptions')
      .delete()
      .eq('user_id', user.id);

    // 5. Delete profile
    await adminSupabase
      .from('profiles')
      .delete()
      .eq('id', user.id);

    // 6. Delete the auth user (this also signs them out)
    const { error: deleteError } = await adminSupabase.auth.admin.deleteUser(user.id);

    if (deleteError) {
      console.error('Failed to delete auth user:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete account. Please contact support.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('Account deletion error:', err);
    return NextResponse.json(
      { error: 'Failed to delete account. Please try again.' },
      { status: 500 }
    );
  }
}
