import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, vehicleId, params } = await request.json();

    if (!action || !vehicleId) {
      return NextResponse.json({ error: 'Missing action or vehicleId' }, { status: 400 });
    }

    switch (action) {
      case 'update_mileage': {
        const mileage = params?.mileage;
        if (!mileage) {
          return NextResponse.json({ error: 'Missing mileage value' }, { status: 400 });
        }

        // Update the vehicle's mileage
        const { error: updateError } = await supabase
          .from('motorcycles')
          .update({ mileage: String(mileage) })
          .eq('id', vehicleId);

        if (updateError) throw updateError;

        // Log to mileage history
        await supabase.from('mileage_history').insert({
          motorcycle_id: vehicleId,
          mileage: Number(mileage),
          recorded_date: new Date().toISOString().split('T')[0],
          notes: 'Updated via chat',
          created_by: user.id,
        });

        return NextResponse.json({ success: true, message: `Mileage updated to ${mileage}` });
      }

      case 'log_purchase': {
        const { productName, category, brand, price, link } = params || {};
        if (!productName) {
          return NextResponse.json({ error: 'Missing product name' }, { status: 400 });
        }

        const { error: insertError } = await supabase.from('vehicle_purchases').insert({
          user_id: user.id,
          vehicle_id: vehicleId,
          product_name: productName,
          product_type: category || 'other',
          brand: brand || null,
          price: price ? Number(price) : null,
          source_url: link || null,
          purchase_date: new Date().toISOString().split('T')[0],
        });

        if (insertError) throw insertError;

        return NextResponse.json({ success: true, message: `Logged purchase: ${productName}` });
      }

      case 'log_maintenance': {
        const { type, notes } = params || {};
        if (!type) {
          return NextResponse.json({ error: 'Missing maintenance type' }, { status: 400 });
        }

        // Append to maintenance_notes
        const { data: vehicle } = await supabase
          .from('motorcycles')
          .select('maintenance_notes')
          .eq('id', vehicleId)
          .single();

        const timestamp = new Date().toLocaleDateString();
        const newNote = `${timestamp}: ${type}${notes ? ` - ${notes}` : ''}`;
        const updatedNotes = vehicle?.maintenance_notes
          ? `${vehicle.maintenance_notes}\n${newNote}`
          : newNote;

        const { error: updateError } = await supabase
          .from('motorcycles')
          .update({ maintenance_notes: updatedNotes })
          .eq('id', vehicleId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, message: `Logged maintenance: ${type}` });
      }

      case 'set_status': {
        const { status } = params || {};
        if (!status) {
          return NextResponse.json({ error: 'Missing status value' }, { status: 400 });
        }

        const validStatuses = ['active', 'sold', 'traded', 'stored', 'maintenance'];
        if (!validStatuses.includes(status)) {
          return NextResponse.json({ error: 'Invalid status value' }, { status: 400 });
        }

        const { error: updateError } = await supabase
          .from('motorcycles')
          .update({ status })
          .eq('id', vehicleId);

        if (updateError) throw updateError;

        return NextResponse.json({ success: true, message: `Status set to ${status}` });
      }

      default:
        return NextResponse.json({ error: 'Unknown action type' }, { status: 400 });
    }
  } catch (error) {
    console.error('Vehicle action error:', error);
    const message = error instanceof Error ? error.message : 'Action failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
