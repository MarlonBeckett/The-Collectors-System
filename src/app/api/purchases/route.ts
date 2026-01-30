import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { product_name, brand, product_type, price, quantity, purchase_date, vehicle_id, source_url, notes } = body;

    if (!product_name?.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('vehicle_purchases')
      .insert({
        user_id: user.id,
        product_name: product_name.trim(),
        brand: brand || null,
        product_type: product_type || 'other',
        price: price || null,
        quantity: quantity || 1,
        purchase_date: purchase_date || new Date().toISOString().split('T')[0],
        vehicle_id: vehicle_id || null,
        source_url: source_url || null,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Create purchase error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create purchase';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id, product_name, brand, product_type, price, quantity, purchase_date, vehicle_id, source_url, notes } = body;

    if (!id) {
      return NextResponse.json({ error: 'Purchase ID is required' }, { status: 400 });
    }

    if (!product_name?.trim()) {
      return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('vehicle_purchases')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { data, error } = await supabase
      .from('vehicle_purchases')
      .update({
        product_name: product_name.trim(),
        brand: brand || null,
        product_type: product_type || 'other',
        price: price || null,
        quantity: quantity || 1,
        purchase_date: purchase_date || new Date().toISOString().split('T')[0],
        vehicle_id: vehicle_id || null,
        source_url: source_url || null,
        notes: notes || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Update purchase error:', error);
    const message = error instanceof Error ? error.message : 'Failed to update purchase';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ error: 'Purchase ID is required' }, { status: 400 });
    }

    // Verify ownership
    const { data: existing } = await supabase
      .from('vehicle_purchases')
      .select('id, user_id')
      .eq('id', id)
      .single();

    if (!existing) {
      return NextResponse.json({ error: 'Purchase not found' }, { status: 404 });
    }

    if (existing.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    const { error } = await supabase
      .from('vehicle_purchases')
      .delete()
      .eq('id', id);

    if (error) throw error;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete purchase error:', error);
    const message = error instanceof Error ? error.message : 'Failed to delete purchase';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
