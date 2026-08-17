import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { isMaintenanceMode, isMaintenanceBypassEmail, getMaintenanceConfig } from '@/lib/maintenance';

// Paths que NUNCA requieren autenticación
const PUBLIC_PATHS = ['/api/webhook', '/api/admin/seed', '/api/debug', '/_next/', '/favicon.ico', '/mantenimiento'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Debug: log maintenance state for all requests
  console.log(`[Middleware] ${pathname} - maintenance mode: ${isMaintenanceMode()}`);

  // Allow truly public paths without any check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }
// Check maintenance mode
  if (isMaintenanceMode()) {
    console.log(`[Middleware] ${pathname} - checking maintenance bypass...`);
    const config = getMaintenanceConfig();
    console.log(`[Middleware] Config:`, config);

    // Get token
    let token: string | undefined;
    const auth = request.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    }
    if (!token) {
      token = request.cookies.get('token')?.value;
    }
    console.log(`[Middleware] ${pathname} - has token:`, !!token);

    // If no token and trying to access protected pages (not login), redirect to login
    if (!token && pathname !== '/login') {
      console.log(`[Middleware] ${pathname} - no token, redirecting to /login`);
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }

    // If has token, check if user has bypass
    if (token) {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        try {
          const secretKey = new TextEncoder().encode(secret);
          const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
          
          const userEmail = payload.email as string | null;
          console.log(`[Middleware] ${pathname} - userEmail:`, userEmail);
          console.log(`[Middleware] ${pathname} - bypass check:`, isMaintenanceBypassEmail(userEmail));
          
          // Check if user has bypass
          if (isMaintenanceBypassEmail(userEmail)) {
            console.log(`[Middleware] ${pathname} - USER HAS BYPASS, allowing`);
            // User has bypass - continue with normal flow
            const headers = new Headers(request.headers);
            headers.set('x-user-id', payload.userId as string);
            headers.set('x-tenant-id', payload.tenantId as string);
            headers.set('x-user-roles', ((payload.roles as string[]) || []).join(','));
            return NextResponse.next({ request: { headers } });
          }
          
          console.log(`[Middleware] ${pathname} - NO BYPASS, redirecting to maintenance`);
          // User doesn't have bypass - redirect to maintenance
          const maintenanceUrl = new URL('/mantenimiento', request.url);
          return NextResponse.redirect(maintenanceUrl);
        } catch (e) {
          console.log(`[Middleware] ${pathname} - token invalid:`, e);
          // Invalid token
        }
      }
    }

    // No token or invalid token: /login is allowed during maintenance
    // (user needs to be able to log in if they have bypass)
    if (pathname === '/login') {
      console.log(`[Middleware] ${pathname} - no token, allowing /login`);
      return NextResponse.next();
    }

    // API auth login allowed during maintenance (handled by route)
    if (pathname === '/api/auth/login') {
      console.log(`[Middleware] ${pathname} - allowing API login`);
      return NextResponse.next();
    }

    // Any other path without valid token with bypass -> maintenance
    console.log(`[Middleware] ${pathname} - fallback to maintenance`);
    const maintenanceUrl = new URL('/mantenimiento', request.url);
    return NextResponse.redirect(maintenanceUrl);
  }

  // Normal flow - no maintenance mode
  // Allow /login without token (redirect handled by client)
  if (pathname === '/login') {
    return NextResponse.next();
  }

  // API auth login without token is allowed
  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // All other routes require authentication
  let token: string | undefined;

  const auth = request.headers.get('Authorization');
  if (auth && auth.startsWith('Bearer ')) {
    token = auth.slice(7);
  }

  if (!token) {
    token = request.cookies.get('token')?.value;
  }

  if (!token) {
    return redirectToLogin(request);
  }
  
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    return redirectToLogin(request);
  }

  try {
    const secretKey = new TextEncoder().encode(secret);
    const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });

    const headers = new Headers(request.headers);
    headers.set('x-user-id', payload.userId as string);
    headers.set('x-tenant-id', payload.tenantId as string);
    headers.set('x-user-roles', ((payload.roles as string[]) || []).join(','));

    return NextResponse.next({ request: { headers } });
  } catch {
    return redirectToLogin(request);
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url);
  loginUrl.searchParams.set('redirect', request.nextUrl.pathname + request.nextUrl.search);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};