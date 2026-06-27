import jwt from 'jsonwebtoken';
import type { AuthProvider, CurrentUser, CurrentTenant, RequestLike } from './types';
import { AuthenticationError } from './errors';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  roles: string[];
}

export function generateToken(user: JwtPayload, secret: string): string {
  return jwt.sign(user, secret, { expiresIn: '24h' });
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
      const payload = jwt.verify(token, this.secret) as JwtPayload;
      return {
        userId: payload.userId,
        tenantId: payload.tenantId,
        roles: payload.roles,
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
