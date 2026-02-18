import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Handle auth code exchange (email confirmation, password reset, etc.)
  // Supabase redirects back with a ?code= param that must be exchanged for a session
  const code = request.nextUrl.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const url = request.nextUrl.clone();
      url.searchParams.delete('code');
      url.pathname = request.nextUrl.searchParams.get('next') ?? '/dashboard';
      url.searchParams.delete('next');
      return NextResponse.redirect(url);
    }
  }

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Public routes that don't require authentication
  const isPublicRoute = request.nextUrl.pathname === '/' ||
                        request.nextUrl.pathname.startsWith('/login') ||
                        request.nextUrl.pathname.startsWith('/signup') ||
                        request.nextUrl.pathname.startsWith('/auth/confirm') ||
                        request.nextUrl.pathname.startsWith('/share');

  // Auth routes (login/signup pages)
  const isAuthRoute = request.nextUrl.pathname.startsWith('/login') ||
                      request.nextUrl.pathname.startsWith('/signup') ||
                      request.nextUrl.pathname.startsWith('/api/auth');

  // API routes handle their own auth - don't redirect them
  const isApiRoute = request.nextUrl.pathname.startsWith('/api/');

  if (!user && !isPublicRoute && !isApiRoute) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from landing page and auth pages
  if (user && (request.nextUrl.pathname === '/' || isAuthRoute) && !request.nextUrl.pathname.startsWith('/api/auth')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
