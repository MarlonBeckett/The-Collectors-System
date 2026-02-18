import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getVehicleDisplayName } from '@/lib/vehicleUtils';

interface ExpiringVehicle {
  id: string;
  make: string;
  model: string;
  sub_model: string | null;
  year: number;
  plate_number: string | null;
  tab_expiration: string;
  vehicle_type: string | null;
  collection_id: string;
}

async function sendEmail(to: string, subject: string, html: string) {
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: 'The Collectors System <notifications@thecollectorssystem.com>',
      to,
      subject,
      html,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to send email: ${error}`);
  }

  return response.json();
}

function getEmailContent(urgency: string, vehicles: ExpiringVehicle[]): string {
  const vehicleList = vehicles
    .map(
      (v) =>
        `<li><strong>${getVehicleDisplayName(v)}</strong>${v.plate_number ? ` (Plate: ${v.plate_number})` : ''}</li>`
    )
    .join('');

  return `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">The Collectors System</h2>
      <p>The following vehicle tabs ${urgency}:</p>
      <ul style="line-height: 1.8;">
        ${vehicleList}
      </ul>
      <p style="margin-top: 24px; color: #666; font-size: 14px;">
        — The Collectors System
      </p>
    </div>
  `;
}

export async function GET(request: Request) {
  // Verify the request is from a cron job (Vercel or manual trigger)
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  // Allow if no secret is set (development) or if secret matches
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Initialize Supabase client inside the handler (not at module level)
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Calculate target dates
    const formatDate = (date: Date) => date.toISOString().split('T')[0];

    const targetDates = {
      '0_day': formatDate(today),
      '7_day': formatDate(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)),
      '30_day': formatDate(new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)),
    };

    const results = [];

    for (const [notificationType, targetDate] of Object.entries(targetDates)) {
      // Get expiring vehicles with their collection_id
      const { data: expiringVehicles } = await supabaseAdmin
        .from('motorcycles')
        .select('id, make, model, sub_model, year, plate_number, tab_expiration, vehicle_type, collection_id')
        .eq('tab_expiration', targetDate)
        .eq('status', 'active');

      if (!expiringVehicles || expiringVehicles.length === 0) continue;

      // Filter out already-notified vehicles
      const vehiclesToNotify: ExpiringVehicle[] = [];

      for (const vehicle of expiringVehicles) {
        const { data: existingNotification } = await supabaseAdmin
          .from('notification_log')
          .select('id')
          .eq('motorcycle_id', vehicle.id)
          .eq('notification_type', notificationType)
          .eq('sent_date', formatDate(today))
          .single();

        if (!existingNotification) {
          vehiclesToNotify.push(vehicle);
        }
      }

      if (vehiclesToNotify.length === 0) continue;

      // Group vehicles by collection_id
      const vehiclesByCollection = new Map<string, ExpiringVehicle[]>();
      for (const vehicle of vehiclesToNotify) {
        const collectionVehicles = vehiclesByCollection.get(vehicle.collection_id) || [];
        collectionVehicles.push(vehicle);
        vehiclesByCollection.set(vehicle.collection_id, collectionVehicles);
      }

      // Build per-user vehicle lists by looking up collection members
      const userVehicleMap = new Map<string, ExpiringVehicle[]>();

      for (const [collectionId, vehicles] of vehiclesByCollection) {
        // Get members of this collection
        const { data: members } = await supabaseAdmin
          .from('collection_members')
          .select('user_id')
          .eq('collection_id', collectionId);

        if (!members || members.length === 0) continue;

        const userIds = members.map((m) => m.user_id);

        // Get profiles for these members who have notifications enabled
        const { data: profiles } = await supabaseAdmin
          .from('profiles')
          .select('id, email')
          .in('id', userIds)
          .eq('receive_notifications', true)
          .not('email', 'is', null);

        if (!profiles) continue;

        for (const profile of profiles) {
          if (!profile.email) continue;

          const existing = userVehicleMap.get(profile.email) || [];
          existing.push(...vehicles);
          userVehicleMap.set(profile.email, existing);
        }
      }

      // Determine email subject/urgency
      let subject = '';
      let urgency = '';

      switch (notificationType) {
        case '0_day':
          subject = '🚨 Vehicle tabs expire TODAY!';
          urgency = 'expire TODAY';
          break;
        case '7_day':
          subject = '⚠️ Vehicle tabs expiring in 7 days';
          urgency = 'expire in 7 days';
          break;
        case '30_day':
          subject = '📅 Vehicle tabs expiring in 30 days';
          urgency = 'expire in 30 days';
          break;
      }

      // Send personalized email to each user
      let sentCount = 0;
      let failCount = 0;

      for (const [email, vehicles] of userVehicleMap) {
        const html = getEmailContent(urgency, vehicles);

        try {
          await sendEmail(email, subject, html);
          sentCount++;

          // Log notification for each vehicle sent to this user
          for (const vehicle of vehicles) {
            await supabaseAdmin.from('notification_log').insert({
              motorcycle_id: vehicle.id,
              notification_type: notificationType,
              recipient_emails: [email],
            });
          }
        } catch (error) {
          console.error(`Failed to send ${notificationType} email to ${email}:`, error);
          failCount++;
        }
      }

      results.push({
        type: notificationType,
        vehicleCount: vehiclesToNotify.length,
        emailsSent: sentCount,
        emailsFailed: failCount,
        status: failCount === 0 ? 'sent' : sentCount > 0 ? 'partial' : 'failed',
      });
    }

    return NextResponse.json({
      message: 'Notification check complete',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cron error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
