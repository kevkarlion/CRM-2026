// ── Dashboard Shell — client component with sidebar + role ──

'use client';

import type { ReactNode } from 'react';
import { RoleProvider, useRole } from '@/dashboard/context/role-context';
import { Sidebar } from '@/dashboard/components/Sidebar';
import { WorkReportToast } from '@/app/(dashboard)/components/WorkReportToast';
import { useEffect, useState } from 'react';
import { useTheme } from '@/app/providers/ThemeProvider';
import { Sun, Moon, LogOut } from 'lucide-react';

function HeaderBar() {
  const { user, role } = useRole();
  const { theme, toggle: toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [clock, setClock] = useState('');

  // Prevent hydration mismatch by only rendering after mount
  useEffect(() => {
    setMounted(true);

    function tick() {
      const now = new Date();
      setClock(now.toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  const today = new Date();
  const dateStr = today.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-30 bg-white dark:bg-slate-800 border-b border-gray-200 dark:border-slate-700 px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
      <div className="flex items-center gap-4">
        {mounted ? (
          <>
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 dark:text-slate-400">Hola,</span>
              <span className="text-sm font-semibold text-gray-900 dark:text-slate-100">{user.name}</span>
            </div>
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700 dark:bg-brand-900/30 dark:text-brand-300 capitalize">
              {role}
            </span>
          </>
        ) : (
          <div className="h-5 w-40 bg-gray-200 dark:bg-slate-700 animate-pulse rounded" />
        )}
      </div>

      <div className="flex items-center gap-3">
        {mounted && (
          <div className="hidden sm:flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500">
            <span className="capitalize">{dateStr}</span>
            <span className="font-mono tabular-nums text-gray-600 dark:text-slate-300 font-medium">{clock}</span>
          </div>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 dark:text-slate-500 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          title={theme === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 transition-colors font-medium"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Cerrar sesión</span>
        </button>
      </div>
    </header>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <div className="min-h-screen bg-gray-50 dark:bg-slate-900 flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 lg:ml-56 relative z-0">
          <HeaderBar />
          <WorkReportToastWrapper />
          {/* Page content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8 relative z-0">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}

function WorkReportToastWrapper() {
  const { isAdmin } = useRole();
  return <WorkReportToast isAdmin={isAdmin} />;
}
