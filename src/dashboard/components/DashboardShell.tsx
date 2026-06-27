// ── Dashboard Shell — client component with sidebar + role ──

'use client';

import type { ReactNode } from 'react';
import { RoleProvider, useRole } from '@/dashboard/context/role-context';
import { Sidebar } from '@/dashboard/components/Sidebar';

function HeaderBar() {
  const { user, role } = useRole();

  const handleLogout = () => {
    localStorage.removeItem('token');
    window.location.href = '/login';
  };

  return (
    <header className="sticky top-0 z-30 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 h-12 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-sm font-medium text-gray-900">{user.name}</span>
        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-brand-50 text-brand-700 capitalize">
          {role}
        </span>
      </div>
      <button
        onClick={handleLogout}
        className="text-xs text-gray-400 hover:text-red-600 transition-colors font-medium"
      >
        Cerrar sesión
      </button>
    </header>
  );
}

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <HeaderBar />
          {/* Page content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
