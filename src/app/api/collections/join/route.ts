import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

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
    const { joinCode } = body;

    if (!joinCode || typeof joinCode !== 'string') {
      return NextResponse.json(
        { error: 'Join code is required' },
        { status: 400 }
      );
    }

    const normalizedCode = joinCode.trim().toUpperCase();

    if (normalizedCode.length !== 6) {
      return NextResponse.json(
        { error: 'Join code must be 6 characters' },
        { status: 400 }
      );
    }

    // Use the security definer function to join
    const { data, error } = await supabase.rpc('join_collection_by_code', {
      p_join_code: normalizedCode,
    });

    if (error) {
      console.error('Join RPC error:', error);
      return NextResponse.json(
        { error: 'Failed to join collection' },
        { status: 500 }
      );
    }

    // The function returns a JSON object
    const result = data as {
      error?: string;
      success?: boolean;
      collection_id?: string;
      collection_name?: string;
    };

    if (result.error) {
      return NextResponse.json(
        { error: result.error },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      collection: {
        id: result.collection_id,
        name: result.collection_name,
      },
    });
  } catch (error) {
    console.error('Join collection error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
