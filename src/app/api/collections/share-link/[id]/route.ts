import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { is_active } = await request.json();

    // Fetch the share link and verify ownership
    const { data: shareLink } = await supabase
      .from('collection_share_links')
      .select('id, collection_id')
      .eq('id', id)
      .single();

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const { data: collection } = await supabase
      .from('collections')
      .select('owner_id')
      .eq('id', shareLink.collection_id)
      .single();

    if (!collection || collection.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { error: updateError } = await supabase
      .from('collection_share_links')
      .update({ is_active })
      .eq('id', id);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to update share link' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Update share link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Fetch the share link and verify ownership
    const { data: shareLink } = await supabase
      .from('collection_share_links')
      .select('id, collection_id')
      .eq('id', id)
      .single();

    if (!shareLink) {
      return NextResponse.json({ error: 'Share link not found' }, { status: 404 });
    }

    const { data: collection } = await supabase
      .from('collections')
      .select('owner_id')
      .eq('id', shareLink.collection_id)
      .single();

    if (!collection || collection.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 403 });
    }

    const { error: deleteError } = await supabase
      .from('collection_share_links')
      .delete()
      .eq('id', id);

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete share link' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete share link error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
