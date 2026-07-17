'use client';

import Link from 'next/link';
import { PlusIcon, ChatBubbleLeftRightIcon, CalendarDaysIcon } from '@heroicons/react/24/outline';

export function QuickActions() {
  return (
    <div className="flex flex-wrap items-center gap-3">
      <Link
        href="/quotes/new"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <PlusIcon className="h-5 w-5 text-gray-500" />
        Nueva Cotización
      </Link>
      <Link
        href="/negotiations/new"
        className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
      >
        <ChatBubbleLeftRightIcon className="h-5 w-5 text-gray-500" />
        Nueva Negociación
      </Link>
      <button
        disabled
        title="Próximamente"
        className="inline-flex cursor-not-allowed items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-400"
      >
        <CalendarDaysIcon className="h-5 w-5 text-gray-400" />
        Ver Calendario
      </button>
    </div>
  );
}
