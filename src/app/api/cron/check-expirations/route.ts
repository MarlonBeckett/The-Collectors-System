import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

interface ExpiringBike {
  id: string;
  name: string;
  plate_number: string | null;
  tab_expiration: string;
  vehicle_type: string | null;
}

async function sendEmail(to: string[], subject: string, html: string) {
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

    // Get profiles with notifications enabled
    const { data: profiles } = await supabaseAdmin
      .from('profiles')
      .select('email')
      .eq('receive_notifications', true)
      .not('email', 'is', null);

    const recipientEmails = profiles?.map((p) => p.email).filter(Boolean) as string[];

    if (recipientEmails.length === 0) {
      return NextResponse.json({ message: 'No recipients configured' });
    }

    const notifications: { type: string; bikes: ExpiringBike[] }[] = [];

    // Check each notification type
    for (const [notificationType, targetDate] of Object.entries(targetDates)) {
      // Get bikes expiring on this date
      const { data: expiringBikes } = await supabaseAdmin
        .from('motorcycles')
        .select('id, name, plate_number, tab_expiration, vehicle_type')
        .eq('tab_expiration', targetDate)
        .eq('status', 'active');

      if (!expiringBikes || expiringBikes.length === 0) continue;

      // Check which bikes haven't been notified yet today
      const bikesToNotify: ExpiringBike[] = [];

      for (const bike of expiringBikes) {
        const { data: existingNotification } = await supabaseAdmin
          .from('notification_log')
          .select('id')
          .eq('motorcycle_id', bike.id)
          .eq('notification_type', notificationType)
          .eq('sent_date', formatDate(today))
          .single();

        if (!existingNotification) {
          bikesToNotify.push(bike);
        }
      }

      if (bikesToNotify.length > 0) {
        notifications.push({ type: notificationType, bikes: bikesToNotify });
      }
    }

    // Send notifications
    const results = [];

    for (const notification of notifications) {
      const { type, bikes } = notification;

      // Build email content
      let subject = '';
      let urgency = '';

      switch (type) {
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

      const bikeList = bikes
        .map(
          (b) =>
            `<li><strong>${b.name}</strong>${b.plate_number ? ` (Plate: ${b.plate_number})` : ''}</li>`
        )
        .join('');

      const html = `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #333;">The Collectors System</h2>
          <p>The following vehicle tabs ${urgency}:</p>
          <ul style="line-height: 1.8;">
            ${bikeList}
          </ul>
          <p style="margin-top: 24px; color: #666; font-size: 14px;">
            — The Collectors System
          </p>
        </div>
      `;

      try {
        await sendEmail(recipientEmails, subject, html);

        // Log notifications
        for (const bike of bikes) {
          await supabaseAdmin.from('notification_log').insert({
            motorcycle_id: bike.id,
            notification_type: type,
            recipient_emails: recipientEmails,
          });
        }

        results.push({
          type,
          bikeCount: bikes.length,
          recipients: recipientEmails.length,
          status: 'sent',
        });
      } catch (error) {
        results.push({
          type,
          bikeCount: bikes.length,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
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
