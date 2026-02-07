import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { FREE_VEHICLE_LIMIT } from '@/lib/subscription';

interface ExpiredSubscription {
  id: string;
  user_id: string;
  current_period_end: string;
}

interface UserCollection {
  id: string;
}

interface Vehicle {
  id: string;
  name: string;
  created_at: string;
}

interface UserProfile {
  email: string | null;
}

async function sendEmail(to: string, subject: string, html: string) {
  if (!process.env.RESEND_API_KEY) {
    console.log('RESEND_API_KEY not set, skipping email');
    return null;
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'The Collectors System <notifications@thecollectorssystem.com>',
      to: [to],
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error(`Failed to send email: ${error}`);
    return null;
  }

  return response.json();
}

export async function GET(request: Request) {
  // Verify the request is from a cron job
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const now = new Date().toISOString();

    // Find subscriptions that have expired (cancel_at_period_end=true and period has ended)
    const { data: expiredSubs, error: fetchError } = await supabaseAdmin
      .from('subscriptions')
      .select('id, user_id, current_period_end')
      .eq('status', 'active')
      .eq('cancel_at_period_end', true)
      .lt('current_period_end', now);

    if (fetchError) {
      throw new Error(`Failed to fetch expired subscriptions: ${fetchError.message}`);
    }

    if (!expiredSubs || expiredSubs.length === 0) {
      return NextResponse.json({
        message: 'No expired subscriptions to process',
        timestamp: now,
      });
    }

    const results = [];

    for (const sub of expiredSubs as ExpiredSubscription[]) {
      try {
        // Get user's email for notification
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('email')
          .eq('id', sub.user_id)
          .single() as { data: UserProfile | null };

        // Get all collections the user owns
        const { data: collections } = await supabaseAdmin
          .from('collections')
          .select('id')
          .eq('owner_id', sub.user_id) as { data: UserCollection[] | null };

        const collectionIds = collections?.map(c => c.id) || [];

        let deletedCount = 0;
        let keptCount = 0;
        const deletedVehicleNames: string[] = [];

        if (collectionIds.length > 0) {
          // Get all vehicles in user's collections, ordered by created_at DESC
          const { data: vehicles } = await supabaseAdmin
            .from('motorcycles')
            .select('id, name, created_at')
            .in('collection_id', collectionIds)
            .order('created_at', { ascending: false }) as { data: Vehicle[] | null };

          if (vehicles && vehicles.length > FREE_VEHICLE_LIMIT) {
            // Keep the first FREE_VEHICLE_LIMIT (most recent), delete the rest
            const vehiclesToKeep = vehicles.slice(0, FREE_VEHICLE_LIMIT);
            const vehiclesToDelete = vehicles.slice(FREE_VEHICLE_LIMIT);

            keptCount = vehiclesToKeep.length;
            deletedCount = vehiclesToDelete.length;

            for (const vehicle of vehiclesToDelete) {
              deletedVehicleNames.push(vehicle.name);

              // Delete photos from storage first
              const { data: photos } = await supabaseAdmin
                .from('photos')
                .select('storage_path')
                .eq('motorcycle_id', vehicle.id);

              if (photos && photos.length > 0) {
                const paths = photos.map(p => p.storage_path).filter(Boolean);
                if (paths.length > 0) {
                  await supabaseAdmin.storage.from('photos').remove(paths);
                }
              }

              // Delete related records
              await supabaseAdmin.from('photos').delete().eq('motorcycle_id', vehicle.id);
              await supabaseAdmin.from('mileage_history').delete().eq('motorcycle_id', vehicle.id);
              await supabaseAdmin.from('value_history').delete().eq('motorcycle_id', vehicle.id);
              await supabaseAdmin.from('service_logs').delete().eq('motorcycle_id', vehicle.id);
              await supabaseAdmin.from('vehicle_documents').delete().eq('motorcycle_id', vehicle.id);

              // Delete the vehicle
              await supabaseAdmin.from('motorcycles').delete().eq('id', vehicle.id);
            }
          } else {
            keptCount = vehicles?.length || 0;
          }
        }

        // Update subscription status to canceled
        await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'canceled',
            cancel_at_period_end: false,
          })
          .eq('id', sub.id);

        // Send notification email
        if (profile?.email) {
          const subject = deletedCount > 0
            ? `Your subscription has expired - ${deletedCount} vehicles were removed`
            : 'Your subscription has expired';

          const vehicleListHtml = deletedCount > 0
            ? `
              <p style="color: #dc2626; font-weight: bold;">The following ${deletedCount} vehicle(s) have been permanently deleted:</p>
              <ul style="line-height: 1.8; color: #666;">
                ${deletedVehicleNames.map(name => `<li>${name}</li>`).join('')}
              </ul>
              <p>You now have ${keptCount} vehicle(s) remaining (the ${FREE_VEHICLE_LIMIT} most recently added).</p>
            `
            : `<p>You had ${keptCount} vehicle(s), which is within the free plan limit of ${FREE_VEHICLE_LIMIT}. No vehicles were deleted.</p>`;

          const html = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #333;">The Collectors System</h2>
              <p>Your Pro subscription has expired as of ${new Date(sub.current_period_end).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>

              ${vehicleListHtml}

              <p style="margin-top: 24px;">
                <a href="${process.env.NEXT_PUBLIC_APP_URL || 'https://thecollectorssystem.com'}/settings#subscription"
                   style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px;">
                  Resubscribe to Pro
                </a>
              </p>

              <p style="margin-top: 24px; color: #666; font-size: 14px;">
                — The Collectors System
              </p>
            </div>
          `;

          await sendEmail(profile.email, subject, html);
        }

        results.push({
          user_id: sub.user_id,
          status: 'processed',
          vehicles_deleted: deletedCount,
          vehicles_kept: keptCount,
          email_sent: !!profile?.email,
        });
      } catch (err) {
        results.push({
          user_id: sub.user_id,
          status: 'failed',
          error: err instanceof Error ? err.message : 'Unknown error',
        });
      }
    }

    return NextResponse.json({
      message: 'Expired subscription processing complete',
      processed: expiredSubs.length,
      results,
      timestamp: now,
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
