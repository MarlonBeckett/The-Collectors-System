import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

interface RouteContext {
  params: Promise<{ id: string }>;
}

async function verifyShareLinkAccess(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, shareLinkId: string) {
  const { data: shareLink } = await supabase
    .from('collection_share_links')
    .select('id, collection_id')
    .eq('id', shareLinkId)
    .single();

  if (!shareLink) return { error: 'Share link not found', status: 404 };

  const { data: collection } = await supabase
    .from('collections')
    .select('owner_id')
    .eq('id', shareLink.collection_id)
    .single();

  if (!collection) return { error: 'Not authorized', status: 403 };

  if (collection.owner_id === userId) return { shareLink };

  // Check if user is an editor
  const { data: membership } = await supabase
    .from('collection_members')
    .select('role')
    .eq('collection_id', shareLink.collection_id)
    .eq('user_id', userId)
    .single();

  if (!membership || membership.role !== 'editor') {
    return { error: 'Not authorized', status: 403 };
  }

  return { shareLink };
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const { is_active, name } = body;

    const access = await verifyShareLinkAccess(supabase, user.id, id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const updates: Record<string, unknown> = {};
    if (typeof is_active === 'boolean') updates.is_active = is_active;
    if (typeof name === 'string') updates.name = name.trim() || null;

    const { error: updateError } = await supabase
      .from('collection_share_links')
      .update(updates)
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

    const access = await verifyShareLinkAccess(supabase, user.id, id);
    if ('error' in access) {
      return NextResponse.json({ error: access.error }, { status: access.status });
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
