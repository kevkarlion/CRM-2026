'use client';

import { useState } from 'react';
import { OperativeDashboard } from '@/components/operations/dashboard/operative-dashboard';
import { TechnicianList } from '@/components/operations/dashboard/technician-list';
import { CalendarView } from '@/components/operations/agenda/calendar-view';

type Tab = 'dashboard' | 'technicians' | 'agenda';

export default function OperativoPage() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');

  const tabs = [
    { id: 'dashboard' as const, label: 'Panel', icon: '📊' },
    { id: 'technicians' as const, label: 'Técnicos', icon: '👥' },
    { id: 'agenda' as const, label: 'Agenda', icon: '📅' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-4 py-4">
        <h1 className="text-xl font-bold text-gray-900">Centro Operativo</h1>
        <p className="text-sm text-gray-500">Gestión de órdenes de trabajo</p>
      </div>

      {/* Tabs - Mobile First */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-10">
        <div className="flex overflow-x-auto scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 min-w-0 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50'
                  : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
              }`}
            >
              <span className="inline-flex items-center gap-2">
                <span>{tab.icon}</span>
                <span className="hidden sm:inline">{tab.label}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {activeTab === 'dashboard' && <OperativeDashboard />}
        {activeTab === 'technicians' && <TechnicianList />}
        {activeTab === 'agenda' && <CalendarView />}
      </div>
    </div>
  );
}