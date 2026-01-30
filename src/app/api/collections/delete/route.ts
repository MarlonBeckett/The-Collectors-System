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
    const { collectionId } = body;

    if (!collectionId) {
      return NextResponse.json(
        { error: 'Collection ID is required' },
        { status: 400 }
      );
    }

    // Verify user is the owner of this collection
    const { data: collection, error: fetchError } = await supabase
      .from('collections')
      .select('id, owner_id')
      .eq('id', collectionId)
      .single();

    if (fetchError || !collection) {
      return NextResponse.json(
        { error: 'Collection not found' },
        { status: 404 }
      );
    }

    if (collection.owner_id !== user.id) {
      return NextResponse.json(
        { error: 'Only the collection owner can delete a collection' },
        { status: 403 }
      );
    }

    // Delete all vehicles in this collection
    const { error: vehiclesError } = await supabase
      .from('motorcycles')
      .delete()
      .eq('collection_id', collectionId);

    if (vehiclesError) {
      console.error('Delete vehicles error:', vehiclesError);
      return NextResponse.json(
        { error: 'Failed to delete collection vehicles' },
        { status: 500 }
      );
    }

    // Delete all collection members
    const { error: membersError } = await supabase
      .from('collection_members')
      .delete()
      .eq('collection_id', collectionId);

    if (membersError) {
      console.error('Delete members error:', membersError);
      return NextResponse.json(
        { error: 'Failed to delete collection members' },
        { status: 500 }
      );
    }

    // Delete the collection itself
    const { error: deleteError } = await supabase
      .from('collections')
      .delete()
      .eq('id', collectionId);

    if (deleteError) {
      console.error('Delete collection error:', deleteError);
      return NextResponse.json(
        { error: 'Failed to delete collection' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete collection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
