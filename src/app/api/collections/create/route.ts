import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name } = body;

    const collectionName = name?.trim() || 'My Collection';

    // Create the collection
    const { data: collection, error: createError } = await supabase
      .from('collections')
      .insert({
        name: collectionName,
        owner_id: user.id,
      })
      .select()
      .single();

    if (createError) {
      console.error('Create collection error:', createError);
      return NextResponse.json(
        { error: 'Failed to create collection' },
        { status: 500 }
      );
    }

    // Add owner as member
    await supabase
      .from('collection_members')
      .insert({
        collection_id: collection.id,
        user_id: user.id,
        role: 'owner',
      });

    return NextResponse.json({
      success: true,
      collection: {
        id: collection.id,
        name: collection.name,
        join_code: collection.join_code,
      },
    });
  } catch (error) {
    console.error('Create collection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
