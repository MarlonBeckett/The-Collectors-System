import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

function generateInviteCode(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    // Check authentication
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { collectionId, role } = body;

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    if (!role || !['editor', 'viewer'].includes(role)) {
      return NextResponse.json(
        { error: 'Valid role (editor or viewer) is required' },
        { status: 400 }
      );
    }

    // Verify user is the owner of this collection
    const { data: collection, error: collectionError } = await supabase
      .from('collections')
      .select('id, owner_id')
      .eq('id', collectionId)
      .single();

    if (collectionError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the collection owner can create invites' },
        { status: 403 }
      );
    }

    // Generate unique invite code
    const inviteCode = generateInviteCode();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(); // 24 hours

    // Create the invite
    const { data: invite, error: insertError } = await supabase
      .from('collection_invites')
      .insert({
        collection_id: collectionId,
        invite_code: inviteCode,
        role,
        created_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert invite error:', insertError);
      // If code collision, try once more
      if (insertError.code === '23505') {
        const retryCode = generateInviteCode();
        const { data: retryInvite, error: retryError } = await supabase
          .from('collection_invites')
          .insert({
            collection_id: collectionId,
            invite_code: retryCode,
            role,
            created_by: user.id,
            expires_at: expiresAt,
          })
          .select()
          .single();

        if (retryError) {
          return NextResponse.json(
            { error: 'Failed to create invite' },
            { status: 500 }
          );
        }

        return NextResponse.json({
          inviteCode: retryInvite.invite_code,
          expiresAt: retryInvite.expires_at,
          role: retryInvite.role,
        });
      }

      return NextResponse.json(
        { error: 'Failed to create invite' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      inviteCode: invite.invite_code,
      expiresAt: invite.expires_at,
      role: invite.role,
    });
  } catch (error) {
    console.error('Create invite error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
