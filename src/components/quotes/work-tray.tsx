'use client';

import Link from 'next/link';
import { ClockIcon } from '@heroicons/react/24/outline';
import type { WorkTrayItem } from '@/quotes/types/client-quote-types';

interface WorkTrayProps {
  items: WorkTrayItem[];
  loading: boolean;
}

function WorkTraySection({
  title,
  icon,
  items,
  entityType,
}: {
  title: string;
  icon: React.ReactNode;
  items: WorkTrayItem[];
  entityType: WorkTrayItem['category'];
}) {
  const sectionItems = items.filter(i => i.category === entityType).slice(0, 3);
  const remaining = items.filter(i => i.category === entityType).length - 3;

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-4">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-gray-700">
        {icon}
        <span>{title}</span>
      </div>
      {sectionItems.length === 0 ? (
        <p className="text-sm text-gray-400">Sin elementos</p>
      ) : (
        <ul className="space-y-2">
          {sectionItems.map(item => (
            <li key={item.id}>
              <Link
                href={item.entityType === 'quote' ? `/quotes/${item.id}` : `/negotiations/${item.id}`}
                className="block rounded px-2 py-1.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900"
              >
                <span className="font-medium text-gray-900">{item.clientName}</span>
                {item.total != null && (
                  <span className="ml-2 text-gray-500">
                    {new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' }).format(item.total)}
                  </span>
                )}
              </Link>
            </li>
          ))}
          {remaining > 0 && (
            <li className="px-2 text-xs text-gray-400">y {remaining} más</li>
          )}
        </ul>
      )}
    </div>
  );
}

export function WorkTray({ items, loading }: WorkTrayProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="rounded-lg border border-gray-200 bg-white p-4">
            <div className="mb-3 h-4 w-24 animate-pulse rounded bg-gray-200" />
            <div className="space-y-2">
              <div className="h-8 animate-pulse rounded bg-gray-100" />
              <div className="h-8 animate-pulse rounded bg-gray-100" />
              <div className="h-8 animate-pulse rounded bg-gray-100" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <WorkTraySection
        title="Por vencer"
        icon={<ClockIcon className="h-4 w-4 text-orange-500" />}
        items={items}
        entityType="expiring"
      />
      <WorkTraySection
        title="Sin respuesta"
        icon={<ClockIcon className="h-4 w-4 text-amber-500" />}
        items={items}
        entityType="awaiting"
      />
      <WorkTraySection
        title="Aprobaciones recientes"
        icon={<ClockIcon className="h-4 w-4 text-green-500" />}
        items={items}
        entityType="recently_approved"
      />
    </div>
  );
}
