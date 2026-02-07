import { NextResponse, type NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'signup' | 'email' | 'recovery' | 'invite' | null;
  const next = searchParams.get('next') ?? '/dashboard';

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ token_hash, type });

    if (!error) {
      const url = request.nextUrl.clone();
      url.pathname = next;
      url.searchParams.delete('token_hash');
      url.searchParams.delete('type');
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
  }

  const url = request.nextUrl.clone();
  url.pathname = '/login';
  url.searchParams.delete('token_hash');
  url.searchParams.delete('type');
  url.searchParams.delete('next');
  url.searchParams.set('error', 'Could not verify email. Please try again.');
  return NextResponse.redirect(url);
}
