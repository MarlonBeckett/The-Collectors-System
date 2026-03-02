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
    const { collectionId, name } = body;
    if (!collectionId) {
      return NextResponse.json({ error: 'Collection ID is required' }, { status: 400 });
    }

    // Extract toggle fields
    const toggleFields: Record<string, boolean> = {};
    const toggleKeys = [
      'include_vin', 'include_plate', 'include_purchase_info', 'include_tab_expiration',
      'include_notes', 'include_service_records', 'include_documents', 'include_mileage',
      'include_expenses',
    ] as const;
    for (const key of toggleKeys) {
      if (typeof body[key] === 'boolean') toggleFields[key] = body[key];
    }

    // Verify user is the collection owner or editor
    const { data: collection } = await supabase
      .from('collections')
      .select('id, owner_id')
      .eq('id', collectionId)
      .single();

    if (!collection) {
      return NextResponse.json({ error: 'Collection not found' }, { status: 404 });
    }

    if (collection.owner_id !== user.id) {
      // Check if user is an editor
      const { data: membership } = await supabase
        .from('collection_members')
        .select('role')
        .eq('collection_id', collectionId)
        .eq('user_id', user.id)
        .single();

      if (!membership || membership.role !== 'editor') {
        return NextResponse.json({ error: 'Only owners and editors can create share links' }, { status: 403 });
      }
    }

    const token = crypto.randomUUID();

    const { data: shareLink, error: insertError } = await supabase
      .from('collection_share_links')
      .insert({
        collection_id: collectionId,
        token,
        created_by: user.id,
        ...toggleFields,
        ...(name ? { name: name.trim() } : {}),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Create share link error:', insertError);
      return NextResponse.json({ error: 'Failed to create share link' }, { status: 500 });
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const shareUrl = `${origin}/share/${token}`;

    return NextResponse.json({
      id: shareLink.id,
      token: shareLink.token,
      shareUrl,
    });
  } catch (error) {
    console.error('Create share link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
