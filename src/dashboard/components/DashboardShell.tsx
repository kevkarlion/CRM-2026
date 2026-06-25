// ── Dashboard Shell — client component with sidebar + role ──

'use client';

import type { ReactNode } from 'react';
import { RoleProvider } from '@/dashboard/context/role-context';
import { Sidebar } from '@/dashboard/components/Sidebar';

export default function DashboardShell({ children }: { children: ReactNode }) {
  return (
    <RoleProvider>
      <div className="min-h-screen bg-gray-50 flex">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          {/* Page content */}
          <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </RoleProvider>
  );
}
