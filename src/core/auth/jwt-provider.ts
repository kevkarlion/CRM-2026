import { SignJWT, jwtVerify } from 'jose';
import type { AuthProvider, CurrentUser, CurrentTenant, RequestLike } from './types';
import { AuthenticationError } from './errors';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  roles: string[];
}

function toSecretKey(secret: string): Uint8Array {
  return new TextEncoder().encode(secret);
}

export async function generateToken(user: JwtPayload, secret: string): Promise<string> {
  return new SignJWT(user as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(toSecretKey(secret));
}

function extractToken(request: RequestLike): string {
  const auth = request.headers.get('Authorization');
  if (!auth) {
    throw new AuthenticationError('Missing Authorization header');
  }
  const parts = auth.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    throw new AuthenticationError('Invalid Authorization header format');
  }
  return parts[1];
}

export class JwtAuthProvider implements AuthProvider {
  constructor(private secret: string) {}

  async extractUser(request: RequestLike): Promise<CurrentUser> {
    try {
      const token = extractToken(request);
      const { payload } = await jwtVerify(token, toSecretKey(this.secret), { algorithms: ['HS256'] });
      return {
        userId: payload.userId as string,
        tenantId: payload.tenantId as string,
        roles: payload.roles as string[],
        permissions: [],
      };
    } catch (err) {
      if (err instanceof AuthenticationError) throw err;
      throw new AuthenticationError('Invalid or expired token');
    }
  }

  async extractTenant(request: RequestLike): Promise<CurrentTenant> {
    const user = await this.extractUser(request);
    return { tenantId: user.tenantId };
  }
}
