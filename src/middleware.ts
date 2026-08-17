import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';
import { isMaintenanceMode, isMaintenanceBypassEmail } from '@/lib/maintenance';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/webhook', '/api/admin/seed', '/api/debug', '/_next/', '/favicon.ico', '/mantenimiento'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow public paths without maintenance check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Check maintenance mode
  if (isMaintenanceMode()) {
    // Extract email from token for bypass check
    let token: string | undefined;

    const auth = request.headers.get('Authorization');
    if (auth && auth.startsWith('Bearer ')) {
      token = auth.slice(7);
    }

    if (!token) {
      token = request.cookies.get('token')?.value;
    }

    let userEmail: string | null = null;

    if (token) {
      const secret = process.env.JWT_SECRET;
      if (secret) {
        try {
          const secretKey = new TextEncoder().encode(secret);
          const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
          
          // Get email from JWT payload (stored during login)
          userEmail = payload.email as string | null;
        } catch {
          // Invalid token - will be handled below
        }
      }
    }

    // Check if user has bypass
    if (isMaintenanceBypassEmail(userEmail)) {
      // User has bypass - continue with normal flow
      const headers = new Headers(request.headers);
      
      if (token) {
        const secret = process.env.JWT_SECRET;
        if (secret) {
          try {
            const secretKey = new TextEncoder().encode(secret);
            const { payload } = await jwtVerify(token, secretKey, { algorithms: ['HS256'] });
            headers.set('x-user-id', payload.userId as string);
            headers.set('x-tenant-id', payload.tenantId as string);
            headers.set('x-user-roles', ((payload.roles as string[]) || []).join(','));
          } catch {
            // Continue without user headers
          }
        }
      }
      
      return NextResponse.next({ request: { headers } });
    }

    // User doesn't have bypass - redirect to maintenance page
    const maintenanceUrl = new URL('/mantenimiento', request.url);
    return NextResponse.redirect(maintenanceUrl);
  }

  // Normal flow - no maintenance mode
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
