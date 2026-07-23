import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { jwtVerify } from 'jose';

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/webhook', '/_next/', '/favicon.ico'];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

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
    const { payload } = await jwtVerify(token, secretKey);

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
