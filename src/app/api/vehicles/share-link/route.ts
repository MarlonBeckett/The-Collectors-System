import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { motorcycleId, name, includeVin } = body;
    if (!motorcycleId) {
      return NextResponse.json({ error: 'Vehicle ID is required' }, { status: 400 });
    }

    // Extract toggle fields from request body
    const toggleFields: Record<string, boolean> = {};
    const toggleKeys = [
      'include_vin', 'include_plate', 'include_purchase_info', 'include_tab_expiration',
      'include_notes', 'include_service_records', 'include_documents', 'include_mileage',
    ] as const;
    for (const key of toggleKeys) {
      if (typeof body[key] === 'boolean') toggleFields[key] = body[key];
    }
    // Support legacy includeVin param
    if (typeof includeVin === 'boolean' && !('include_vin' in toggleFields)) {
      toggleFields.include_vin = includeVin;
    }

    // Verify vehicle exists and user has owner/editor access via its collection
    const { data: vehicle } = await supabase
      .from('motorcycles')
      .select('id, collection_id')
      .eq('id', motorcycleId)
      .single();

    if (!vehicle || !vehicle.collection_id) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 });
    }

    const { data: collection } = await supabase
      .from('collections')
      .select('id, owner_id')
      .eq('id', vehicle.collection_id)
      .single();

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    if (collection.owner_id !== user.id) {
      const { data: membership } = await supabase
        .from('collection_members')
        .select('role')
        .eq('collection_id', vehicle.collection_id)
        .eq('user_id', user.id)
        .single();

      if (!membership || membership.role !== 'editor') {
        return NextResponse.json({ error: 'Only owners and editors can create share links' }, { status: 403 });
      }
    }

    const token = crypto.randomUUID();

    const { data: shareLink, error: insertError } = await supabase
      .from('vehicle_share_links')
      .insert({
        motorcycle_id: motorcycleId,
        token,
        created_by: user.id,
        ...toggleFields,
        ...(name ? { name: name.trim() } : {}),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Create vehicle share link error:', insertError);
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const shareUrl = `${origin}/share/vehicle/${token}`;

    return NextResponse.json({
      id: shareLink.id,
      token: shareLink.token,
      shareUrl,
    });
  } catch (error) {
    console.error('Create vehicle share link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
