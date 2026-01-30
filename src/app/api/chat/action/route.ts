import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ChatAction } from '@/types/database';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, sessionId } = await request.json() as { action: ChatAction; sessionId: string };

    if (!action || !action.actionType) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    let result: { success: boolean; message: string; data?: unknown } = { success: false, message: 'Unknown action' };

    switch (action.actionType) {
      case 'update_mileage': {
        if (!action.vehicleId || !action.params?.mileage) {
          return NextResponse.json({ error: 'Vehicle ID and mileage required' }, { status: 400 });
        }

        const mileage = String(action.params.mileage);
        const numericMileage = parseInt(mileage.replace(/[^\d]/g, ''), 10);

        // Update the vehicle's mileage
        const { error: updateError } = await supabase
          .from('motorcycles')
          .update({ mileage, updated_at: new Date().toISOString() })
          .eq('id', action.vehicleId);

        if (updateError) throw updateError;

        // Log to mileage history
        await supabase.from('mileage_history').insert({
          motorcycle_id: action.vehicleId,
          mileage: numericMileage,
          recorded_date: new Date().toISOString().split('T')[0],
          notes: 'Updated via chat',
          created_by: user.id,
        });

        result = { success: true, message: `Mileage updated to ${mileage}` };
        break;
      }

      case 'log_purchase': {
        if (!action.params?.productName) {
          return NextResponse.json({ error: 'Product name required' }, { status: 400 });
        }

        const { error: insertError } = await supabase.from('vehicle_purchases').insert({
          user_id: user.id,
          vehicle_id: action.vehicleId || null,
          chat_session_id: sessionId || null,
          product_name: String(action.params.productName),
          product_type: action.params.category ? String(action.params.category) : null,
          brand: action.params.brand ? String(action.params.brand) : null,
          price: action.params.price ? Number(action.params.price) : null,
          notes: action.params.notes ? String(action.params.notes) : null,
        });

        if (insertError) throw insertError;

        result = { success: true, message: `Logged purchase: ${action.params.productName}` };
        break;
      }

      case 'log_maintenance': {
        if (!action.vehicleId || !action.params?.type) {
          return NextResponse.json({ error: 'Vehicle ID and maintenance type required' }, { status: 400 });
        }

        // Get current maintenance notes
        const { data: vehicle } = await supabase
          .from('motorcycles')
          .select('maintenance_notes')
          .eq('id', action.vehicleId)
          .single();

        const existingNotes = vehicle?.maintenance_notes || '';
        const newNote = `[${new Date().toLocaleDateString()}] ${action.params.type}${action.params.notes ? `: ${action.params.notes}` : ''}`;
        const updatedNotes = existingNotes ? `${newNote}\n${existingNotes}` : newNote;

        const { error: updateError } = await supabase
          .from('motorcycles')
          .update({
            maintenance_notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', action.vehicleId);

        if (updateError) throw updateError;

        result = { success: true, message: `Logged maintenance: ${action.params.type}` };
        break;
      }

      case 'set_status': {
        if (!action.vehicleId || !action.params?.status) {
          return NextResponse.json({ error: 'Vehicle ID and status required' }, { status: 400 });
        }

        const validStatuses = ['active', 'sold', 'traded', 'stored', 'maintenance'];
        if (!validStatuses.includes(String(action.params.status))) {
          return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
        }

        // Build update object - include note if provided along with status change
        const statusUpdate: { status: string; updated_at: string; maintenance_notes?: string } = {
          status: String(action.params.status),
          updated_at: new Date().toISOString(),
        };

        // If there's a note param, add it to maintenance_notes
        if (action.params.note) {
          const { data: vehicleData } = await supabase
            .from('motorcycles')
            .select('maintenance_notes')
            .eq('id', action.vehicleId)
            .single();

          const existingNotes = vehicleData?.maintenance_notes || '';
          const newNote = `[${new Date().toLocaleDateString()}] ${action.params.note}`;
          statusUpdate.maintenance_notes = existingNotes ? `${newNote}\n${existingNotes}` : newNote;
        }

        const { error: updateError } = await supabase
          .from('motorcycles')
          .update(statusUpdate)
          .eq('id', action.vehicleId);

        if (updateError) throw updateError;

        const noteMsg = action.params.note ? ` and added note` : '';
        result = { success: true, message: `Status updated to ${action.params.status}${noteMsg}` };
        break;
      }

      case 'add_note': {
        if (!action.vehicleId || !action.params?.note) {
          return NextResponse.json({ error: 'Vehicle ID and note required' }, { status: 400 });
        }

        // Get current notes
        const { data: vehicle } = await supabase
          .from('motorcycles')
          .select('maintenance_notes')
          .eq('id', action.vehicleId)
          .single();

        const existingNotes = vehicle?.maintenance_notes || '';
        const newNote = `[${new Date().toLocaleDateString()}] ${action.params.note}`;
        const updatedNotes = existingNotes ? `${newNote}\n${existingNotes}` : newNote;

        const { error: updateError } = await supabase
          .from('motorcycles')
          .update({
            maintenance_notes: updatedNotes,
            updated_at: new Date().toISOString(),
          })
          .eq('id', action.vehicleId);

        if (updateError) throw updateError;

        result = { success: true, message: `Added note: ${action.params.note}` };
        break;
      }

      default:
        return NextResponse.json({ error: 'Unknown action type' }, { status: 400 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Chat action error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to execute action', details: errorMessage },
      { status: 500 }
    );
  }
}
