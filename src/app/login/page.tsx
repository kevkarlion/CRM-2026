'use client';

import { FormEvent, Suspense, useState } from 'react';
import { useSearchParams } from 'next/navigation';

function LoginForm() {
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get('redirect') || '/dashboard/admin';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [debug, setDebug] = useState<string[]>([]);

  const log = (msg: string) => setDebug(prev => [...prev, `${new Date().toISOString().slice(11, 23)} — ${msg}`]);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    setError('');
    setDebug([]);
    setLoading(true);

    log('handleSubmit started');
    log(`redirectTo: ${redirectTo}`);

    try {
      log('Fetching /api/auth/login...');
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      log(`Response status: ${res.status}`);
      log(`Response headers Set-Cookie: ${res.headers.get('set-cookie') ?? 'NONE'}`);

      const text = await res.text();
      log(`Response body (first 200 chars): ${text.slice(0, 200)}`);

      let data: Record<string, unknown>;
      try { data = JSON.parse(text); } catch { data = { raw: text }; }

      if (!res.ok) {
        const msg = (data.error as string) || 'Login failed';
        log(`ERROR: ${msg}`);
        setError(msg);
        setLoading(false);
        return;
      }

      if (!data.token) {
        log('ERROR: No token in response');
        setError('No token received');
        setLoading(false);
        return;
      }

      log('Token received OK');
      localStorage.setItem('token', data.token as string);
      if (data.tenantId) {
        localStorage.setItem('tenantId', data.tenantId as string);
      }
      log('localStorage set OK');

      // Check if cookie was actually stored
      const cookieAfter = document.cookie;
      log(`Cookies after response: ${cookieAfter || 'NONE (httpOnly expected)'}`);

      log('READY TO REDIRECT — fix applied, redirect is OFF for debug');
      // window.location.href = redirectTo;  // <-- DISABLED FOR DEBUG
      setLoading(false);
    } catch (err) {
      log(`CATCH: ${err instanceof Error ? err.message : String(err)}`);
      setError('Network error. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm">
        <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:p-8">
          <h1 className="mb-6 text-center text-2xl font-bold text-gray-900">
            CRM 2026
          </h1>

          {error && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          {/* DEBUG PANEL — remove after diagnosis */}
          {debug.length > 0 && (
            <div className="mt-4 rounded-lg bg-gray-900 p-3">
              <p className="mb-2 text-xs font-bold text-green-400">DEBUG LOG</p>
              {debug.map((line, i) => (
                <p key={i} className="font-mono text-xs text-gray-300 whitespace-pre-wrap">{line}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
