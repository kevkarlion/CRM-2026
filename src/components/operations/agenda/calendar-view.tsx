'use client';

import { useState, useEffect, useMemo } from 'react';
import { api } from '@/lib/api-client';
import { parseLocalDate } from '@/operations/helpers/date-utils';

type CalendarView = 'day' | 'week' | 'month';

interface AgendaItem {
  _id: string;
  workOrderNumber: string;
  title: string;
  status: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  scheduledDate: string;
  scheduledStart?: string;
  scheduledEnd?: string;
  clientSnapshot?: {
    name?: string;
    phone?: string;
  };
  locationSnapshot?: {
    address?: string;
  };
  technicians: Array<{
    _id: string;
    name: string;
    email?: string;
    phone?: string;
  }>;
}

interface CalendarViewProps {
  onItemClick?: (workOrderId: string) => void;
  initialDate?: Date;
}

export function CalendarView({ onItemClick, initialDate = new Date() }: CalendarViewProps) {
  const [view, setView] = useState<CalendarView>('week');
  const [currentDate, setCurrentDate] = useState(initialDate);
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { startDate, endDate } = useMemo(() => {
    const start = new Date(currentDate);
    const end = new Date(currentDate);

    if (view === 'day') {
      start.setHours(0, 0, 0, 0);
      end.setHours(23, 59, 59, 999);
    } else if (view === 'week') {
      const day = start.getDay();
      const diff = start.getDate() - day + (day === 0 ? -6 : 1);
      start.setDate(diff);
      start.setHours(0, 0, 0, 0);
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    } else {
      start.setDate(1);
      start.setHours(0, 0, 0, 0);
      end.setMonth(end.getMonth() + 1, 0);
      end.setHours(23, 59, 59, 999);
    }

    return { startDate: start, endDate: end };
  }, [currentDate, view]);

  useEffect(() => {
    loadAgenda();
  }, [startDate, endDate]);

  async function loadAgenda() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<AgendaItem[]>(
        `/api/operations/dashboard?view=agenda&startDate=${startDate.toISOString()}&endDate=${endDate.toISOString()}`
      );
      setAgendaItems(data);
    } catch (err) {
      console.error('Error loading agenda:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar la agenda');
    } finally {
      setLoading(false);
    }
  }

  const navigate = (direction: number) => {
    const newDate = new Date(currentDate);
    if (view === 'day') {
      newDate.setDate(newDate.getDate() + direction);
    } else if (view === 'week') {
      newDate.setDate(newDate.getDate() + direction * 7);
    } else {
      newDate.setMonth(newDate.getMonth() + direction);
    }
    setCurrentDate(newDate);
  };

  const getPriorityColor = (priority: AgendaItem['priority']) => {
    switch (priority) {
      case 'urgent':
        return 'bg-red-500';
      case 'high':
        return 'bg-orange-500';
      case 'medium':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-gray-100 text-gray-700',
      scheduled: 'bg-blue-100 text-blue-700',
      in_progress: 'bg-yellow-100 text-yellow-700',
      completed: 'bg-green-100 text-green-700',
      cancelled: 'bg-red-100 text-red-700',
    };
    const labels: Record<string, string> = {
      pending: 'Pendiente',
      scheduled: 'Programado',
      in_progress: 'En curso',
      completed: 'Completado',
      cancelled: 'Cancelado',
    };
    return { style: styles[status] || styles.pending, label: labels[status] || status };
  };

  const formatTime = (time?: string) => {
    if (!time) return '';
    return time.substring(0, 5);
  };

  // Group items by date for week/month view
  const groupedByDate = useMemo(() => {
    const groups: Record<string, AgendaItem[]> = {};
    agendaItems.forEach((item) => {
      const dateKey = parseLocalDate(item.scheduledDate).toDateString();
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(item);
    });
    return groups;
  }, [agendaItems]);

  // Generate calendar days for month view
  const calendarDays = useMemo(() => {
    const days: Date[] = [];
    const firstDay = new Date(startDate);
    firstDay.setDate(1);
    const lastDay = new Date(endDate);
    
    const startDayOfWeek = firstDay.getDay();
    const daysToSubtract = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;
    firstDay.setDate(firstDay.getDate() - daysToSubtract);
    
    for (let i = 0; i < 42; i++) {
      days.push(new Date(firstDay));
      firstDay.setDate(firstDay.getDate() + 1);
    }
    return days;
  }, [startDate, endDate]);

  const isToday = (date: Date) => {
    const today = new Date();
    return date.toDateString() === today.toDateString();
  };

  const isCurrentMonth = (date: Date) => {
    return date.getMonth() === currentDate.getMonth();
  };

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
        <button
          onClick={loadAgenda}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header with navigation */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Anterior"
          >
            ←
          </button>
          <span className="text-sm font-medium text-gray-900 min-w-[120px] text-center">
            {view === 'day'
              ? currentDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
              : view === 'week'
              ? `${startDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })} - ${endDate.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' })}`
              : currentDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' })}
          </span>
          <button
            onClick={() => navigate(1)}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="Siguiente"
          >
            →
          </button>
          <button
            onClick={() => setCurrentDate(new Date())}
            className="px-3 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            Hoy
          </button>
        </div>

        {/* View selector */}
        <div className="flex bg-gray-100 rounded-lg p-1">
          {(['day', 'week', 'month'] as const).map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                view === v
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {v === 'day' ? 'Día' : v === 'week' ? 'Semana' : 'Mes'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="animate-pulse space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-gray-200 rounded-lg" />
          ))}
        </div>
      ) : view === 'month' ? (
        /* Month view */
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'].map((day) => (
              <div key={day} className="px-2 py-2 text-center text-xs font-medium text-gray-500">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {calendarDays.map((date, i) => {
              const dateKey = date.toDateString();
              const dayItems = groupedByDate[dateKey] || [];
              return (
                <div
                  key={i}
                  className={`min-h-[80px] border-b border-r border-gray-100 p-1 ${
                    !isCurrentMonth(date) ? 'bg-gray-50' : ''
                  }`}
                >
                  <div
                    className={`text-xs font-medium mb-1 ${
                      isToday(date)
                        ? 'bg-gray-900 text-white rounded-full w-6 h-6 flex items-center justify-center'
                        : isCurrentMonth(date)
                        ? 'text-gray-700'
                        : 'text-gray-400'
                    }`}
                  >
                    {date.getDate()}
                  </div>
                  <div className="space-y-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item._id}
                        onClick={() => onItemClick?.(item._id)}
                        className={`text-xs p-1 rounded truncate cursor-pointer hover:opacity-80 ${getPriorityColor(
                          item.priority
                        )} text-white`}
                        title={`${item.title} - ${item.technicians.map((t) => t.name).join(', ')}`}
                      >
                        {formatTime(item.scheduledStart)} {item.title}
                      </div>
                    ))}
                    {dayItems.length > 3 && (
                      <div className="text-xs text-gray-500 text-center">
                        +{dayItems.length - 3} más
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : view === 'week' ? (
        /* Week view */
        <div className="space-y-2">
          {Object.entries(groupedByDate).length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-gray-500 text-sm">No hay órdenes de trabajo programadas</p>
            </div>
          ) : (
            Object.entries(groupedByDate)
              .sort(([a], [b]) => new Date(a).getTime() - new Date(b).getTime())
              .map(([dateKey, items]) => (
                <div key={dateKey} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div
                      className={`text-sm font-medium ${
                        isToday(new Date(dateKey)) ? 'text-gray-900' : 'text-gray-600'
                      }`}
                    >
                      {new Date(dateKey).toLocaleDateString('es-ES', {
                        weekday: 'long',
                        day: 'numeric',
                        month: 'short',
                      })}
                    </div>
                    {isToday(new Date(dateKey)) && (
                      <span className="px-2 py-0.5 bg-gray-900 text-white text-xs rounded-full">
                        Hoy
                      </span>
                    )}
                  </div>
                  <div className="space-y-2">
                    {items
                      .sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''))
                      .map((item) => {
                        const status = getStatusBadge(item.status);
                        return (
                          <div
                            key={item._id}
                            onClick={() => onItemClick?.(item._id)}
                            className={`bg-white border border-gray-200 rounded-lg p-3 cursor-pointer hover:border-gray-300 transition-colors ${
                              isToday(new Date(dateKey)) ? 'border-l-4 border-l-gray-900' : ''
                            }`}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex items-start gap-2 flex-1">
                                <div className={`w-1 h-full min-h-[40px] rounded-full ${getPriorityColor(item.priority)}`} />
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs text-gray-500">{item.workOrderNumber}</span>
                                    <span className={`px-2 py-0.5 text-xs rounded-full ${status.style}`}>
                                      {status.label}
                                    </span>
                                  </div>
                                  <h4 className="text-sm font-medium text-gray-900 truncate">{item.title}</h4>
                                  <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                                    {item.scheduledStart && (
                                      <span>
                                        {formatTime(item.scheduledStart)}
                                        {item.scheduledEnd && ` - ${formatTime(item.scheduledEnd)}`}
                                      </span>
                                    )}
                                    {item.locationSnapshot?.address && (
                                      <span className="truncate">📍 {item.locationSnapshot.address}</span>
                                    )}
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                {item.technicians.length > 0 ? (
                                  <div className="flex -space-x-2">
                                    {item.technicians.slice(0, 2).map((tech) => (
                                      <div
                                        key={tech._id}
                                        className="w-6 h-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center"
                                        title={tech.name}
                                      >
                                        <span className="text-xs font-medium text-gray-600">
                                          {tech.name.charAt(0).toUpperCase()}
                                        </span>
                                      </div>
                                    ))}
                                    {item.technicians.length > 2 && (
                                      <div className="w-6 h-6 rounded-full bg-gray-100 border-2 border-white flex items-center justify-center">
                                        <span className="text-xs text-gray-500">+{item.technicians.length - 2}</span>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-xs text-gray-400">Sin técnico</span>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              ))
          )}
        </div>
      ) : (
        /* Day view */
        <div className="space-y-2">
          {agendaItems.length === 0 ? (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
              <p className="text-gray-500 text-sm">No hay órdenes de trabajo para hoy</p>
            </div>
          ) : (
            agendaItems
              .sort((a, b) => (a.scheduledStart || '').localeCompare(b.scheduledStart || ''))
              .map((item) => {
                const status = getStatusBadge(item.status);
                return (
                  <div
                    key={item._id}
                    onClick={() => onItemClick?.(item._id)}
                    className="bg-white border border-gray-200 rounded-lg p-4 cursor-pointer hover:border-gray-300 transition-colors"
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-2 h-full min-h-[60px] rounded-full ${getPriorityColor(item.priority)}`} />
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs text-gray-500">{item.workOrderNumber}</span>
                          <span className={`px-2 py-0.5 text-xs rounded-full ${status.style}`}>
                            {status.label}
                          </span>
                          <span className="text-xs text-gray-400 capitalize">{item.category}</span>
                        </div>
                        <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
                        {item.scheduledStart && (
                          <p className="text-xs text-gray-500 mt-1">
                            {formatTime(item.scheduledStart)}
                            {item.scheduledEnd && ` - ${formatTime(item.scheduledEnd)}`}
                          </p>
                        )}
                        {item.clientSnapshot?.name && (
                          <p className="text-xs text-gray-500 mt-1">👤 {item.clientSnapshot.name}</p>
                        )}
                        {item.locationSnapshot?.address && (
                          <p className="text-xs text-gray-500 mt-0.5">📍 {item.locationSnapshot.address}</p>
                        )}
                      </div>
                      <div>
                        {item.technicians.length > 0 ? (
                          <div className="flex flex-col items-end gap-1">
                            {item.technicians.map((tech) => (
                              <div
                                key={tech._id}
                                className="flex items-center gap-1.5"
                              >
                                <div className="w-6 h-6 rounded-full bg-gray-200 flex items-center justify-center">
                                  <span className="text-xs font-medium text-gray-600">
                                    {tech.name.charAt(0).toUpperCase()}
                                  </span>
                                </div>
                                <span className="text-xs text-gray-600">{tech.name}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Sin técnico</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
          )}
        </div>
      )}
    </div>
  );
}