// ── Sidebar Navigation — mobile-first ──────────────────────

'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect } from 'react';
import { useRole } from '@/dashboard/context/role-context';
import type { TenantRoleName } from '@/rbac/permissions';
import {
  LayoutDashboard,
  Wrench,
  BarChart3,
  Users,
  Settings,
  Target,
  FileText,
  Building2,
  ClipboardList,
  Calendar,
  ClipboardCheck,
  Contact,
  Menu,
  X,
  Map,
  type LucideIcon,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: TenantRoleName[];
}

const iconMap: Record<string, LucideIcon> = {
  Resumen: LayoutDashboard,
  'Mi Panel': Wrench,
  Operaciones: Building2,
  Comercial: BarChart3,
  Pipeline: ClipboardList,
  Técnicos: Users,
  Admin: Settings,
  Leads: Target,
  'Centro Operativo Comercial': FileText,
  'Centro Operativo Técnico': ClipboardCheck,
  Clientes: Contact,
  'Órdenes de Trabajo': Wrench,
  'Mi Calendario': Calendar,
  'Visitas Técnicas': ClipboardCheck,
  Mapa: Map,
};

const navItems: NavItem[] = [
  { label: 'Resumen', href: '/dashboard', icon: iconMap['Resumen'], roles: ['Owner', 'Administrator', 'Supervisor', 'Sales', 'Accounting', 'Dispatcher'] },
  { label: 'Mi Panel', href: '/dashboard/technician', icon: iconMap['Mi Panel'], roles: ['Technician'] },
  { label: 'Operaciones', href: '/dashboard/supervisor', icon: iconMap['Operaciones'], roles: ['Owner', 'Administrator', 'Supervisor', 'Dispatcher'] },
  { label: 'Comercial', href: '/dashboard/commercial', icon: iconMap['Comercial'], roles: ['Owner', 'Administrator', 'Sales', 'Supervisor'] },
  { label: 'Pipeline', href: '/leads/pipeline', icon: iconMap['Pipeline'], roles: ['Owner', 'Administrator', 'Supervisor', 'Sales'] },
  { label: 'Técnicos', href: '/dashboard/technicians', icon: iconMap['Técnicos'], roles: ['Supervisor', 'Dispatcher'] },
  { label: 'Admin', href: '/dashboard/admin', icon: iconMap['Admin'], roles: ['Owner', 'Administrator'] },
  { label: 'Leads', href: '/leads', icon: iconMap['Leads'], roles: ['Sales', 'Administrator', 'Owner', 'Supervisor'] },
  { label: 'Clientes', href: '/clients', icon: iconMap['Clientes'], roles: ['Owner', 'Administrator', 'Supervisor', 'Sales', 'Accounting'] },
  { label: 'Centro Operativo Comercial', href: '/quotes', icon: iconMap['Centro Operativo Comercial'], roles: ['Sales', 'Administrator', 'Owner', 'Supervisor'] },
  // Order for technicians/operations
  { label: 'Centro Operativo Técnico', href: '/centro-operativo', icon: iconMap['Centro Operativo Técnico'], roles: ['Owner', 'Administrator', 'Supervisor', 'Dispatcher', 'Technician'] },
  { label: 'Órdenes de Trabajo', href: '/work-orders', icon: iconMap['Órdenes de Trabajo'], roles: ['Owner', 'Administrator', 'Supervisor', 'Dispatcher', 'Technician', 'Sales', 'Accounting'] },
  { label: 'Visitas Técnicas', href: '/technical-visits', icon: iconMap['Visitas Técnicas'], roles: ['Owner', 'Administrator', 'Supervisor', 'Dispatcher', 'Sales', 'Technician'] },
  { label: 'Mi Calendario', href: '/work-orders/calendar', icon: iconMap['Mi Calendario'], roles: ['Technician', 'Supervisor', 'Dispatcher', 'Owner', 'Administrator'] },
  { label: 'Mapa Operativo', href: '/mapa', icon: iconMap['Mapa'], roles: ['Owner', 'Administrator', 'Supervisor', 'Dispatcher', 'Technician'] },
];

export function Sidebar() {
  const pathname = usePathname();
  const { role, loading, user } = useRole();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Only render after mount to avoid hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  // Don't render sidebar content until mounted
  if (!mounted || loading) {
    return (
      <aside className="fixed top-0 left-0 z-50 h-full w-56 bg-gray-950 border-r border-gray-800">
        <div className="p-4 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gray-800 animate-pulse" />
            <div className="h-4 w-20 bg-gray-800 rounded animate-pulse" />
          </div>
          <div className="h-3 w-16 bg-gray-800 rounded animate-pulse mt-2" />
        </div>
        <div className="p-3 space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 bg-gray-800 rounded-lg animate-pulse" />
          ))}
        </div>
      </aside>
    );
  }

  const visibleItems = navItems.filter((item) => item.roles.includes(role));

  // Highlight the most specific nav item matching the current path
  // (segment-aware prefix match: /leads/abc123 highlights "Leads",
  // while /leads/pipeline keeps highlighting only "Pipeline").
  const activeHref = visibleItems
    .filter((item) => pathname === item.href || pathname.startsWith(item.href + '/'))
    .sort((a, b) => b.href.length - a.href.length)[0]?.href;

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed bottom-4 right-4 z-[60] w-12 h-12 bg-brand-600 text-white rounded-full shadow-lg flex items-center justify-center"
        aria-label="Menú"
      >
        {mobileOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
      </button>

      {/* Desktop sidebar — fixed, always black */}
      <aside className={`fixed top-0 left-0 z-50 flex h-full w-56 flex-col bg-gray-950 border-r border-gray-800 transform transition-transform duration-200 lg:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-4 border-b border-gray-800 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-brand-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">C</span>
            </div>
            <span className="font-semibold text-white text-sm">CRM</span>
          </div>
          <span className="text-xs text-gray-500 mt-1 block capitalize">{role}</span>
        </div>

        <nav className="sidebar-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-1">
          {visibleItems.map((item) => {
            const active = item.href === activeHref;
            const ItemIcon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-brand-600 text-white'
                    : 'text-gray-400 hover:bg-gray-800 hover:text-white'
                }`}
              >
                <ItemIcon className="w-5 h-5 flex-shrink-0" />
                {item.label}
              </Link>
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