import { setAuthProvider, JwtAuthProvider } from '@/core/auth';

export function initAuth(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    console.warn('JWT_SECRET not set, using HeaderAuthProvider');
    return;
  }
  setAuthProvider(new JwtAuthProvider(secret));
}
