// ── Sidebar Navigation — mobile-first ──────────────────────

'use client';

import { usePathname } from 'next/navigation';
import { useState } from 'react';
import type { TenantRoleName } from '@/rbac/permissions';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  roles: TenantRoleName[];
}

const navItems: NavItem[] = [
  { label: 'Resumen', href: '/dashboard', icon: '⊟', roles: ['Owner', 'Administrator', 'Supervisor', 'Sales', 'Accounting', 'Dispatcher', 'Technician'] },
  { label: 'Operaciones', href: '/dashboard/supervisor', icon: '⚙', roles: ['Owner', 'Administrator', 'Supervisor', 'Dispatcher'] },
  { label: 'Comercial', href: '/dashboard/commercial', icon: '📊', roles: ['Owner', 'Administrator', 'Sales', 'Supervisor'] },
  { label: 'Técnicos', href: '/dashboard/technician', icon: '🔧', roles: ['Technician', 'Supervisor', 'Dispatcher'] },
  { label: 'Admin', href: '/dashboard/admin', icon: '⚙', roles: ['Owner', 'Administrator'] },
];

interface SidebarProps {
  currentRole: TenantRoleName;
}

export function Sidebar({ currentRole }: SidebarProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const visibleItems = navItems.filter((item) => item.roles.includes(currentRole));

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-50 w-12 h-12 bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center"
        aria-label="Menú"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {mobileOpen
            ? <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            : <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          }
        </svg>
      </button>

      {/* Desktop sidebar */}
      <aside className={`fixed top-0 left-0 z-40 h-full w-56 bg-white border-r border-gray-200 transform transition-transform duration-200 lg:translate-x-0 lg:static lg:h-auto ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-gray-900 text-sm">CRM 2026</span>
          </div>
          <span className="text-xs text-gray-400 mt-1 block capitalize">{currentRole}</span>
        </div>

        <nav className="p-3 space-y-1">
          {visibleItems.map((item) => {
            const active = pathname === item.href;
            return (
              <a
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                {item.label}
              </a>
            );
          })}
        </nav>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-black/20 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}
    </>
  );
}
