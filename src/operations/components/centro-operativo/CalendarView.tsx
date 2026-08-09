'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { CALENDAR_PRIORITY_COLORS } from '@/operations/constants/status-colors';
import { parseLocalDate } from '@/operations/helpers/date-utils';
import type { CalendarEvent, TechnicianWorkload } from '@/operations/types/centro-operativo';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarViewProps {
  events: CalendarEvent[];
  technicians?: TechnicianWorkload[];
  onEventClick: (event: CalendarEvent) => void;
  className?: string;
  currentTechnicianId?: string | null;
}

const VIEW_LABELS: Record<ViewMode, string> = {
  day: 'Día',
  week: 'Semana',
  month: 'Mes',
};

const DAY_NAMES_SHORT = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const DAY_NAMES_LONG = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

const HOUR_START = 6;
const HOUR_END = 22;

function startOfDay(d: Date): Date {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function getWeekStart(d: Date): Date {
  const r = new Date(d);
  const day = r.getDay(); // 0 = Sunday
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
  console.log('[Calendar] getWeekStart:', d.toISOString(), '->', r.toISOString(), 'day:', day);
  return r;
}

function formatHour(h: number): string {
  return `${String(h).padStart(2, '0')}:00`;
}

function formatTimeShort(iso: string | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

function getEventsForDay(events: CalendarEvent[], day: Date): CalendarEvent[] {
  return events.filter((e) => {
    return isSameDay(parseLocalDate(e.scheduledDate), day);
  });
}

function getEventPosition(event: CalendarEvent): { top: number; height: number } | null {
  if (!event.scheduledStart) return null;
  const start = new Date(event.scheduledStart);
  const end = event.scheduledEnd ? new Date(event.scheduledEnd) : new Date(start.getTime() + 60 * 60 * 1000);

  const startHour = start.getHours() + start.getMinutes() / 60;
  const endHour = end.getHours() + end.getMinutes() / 60;

  const clampedStart = Math.max(startHour, HOUR_START);
  const clampedEnd = Math.min(endHour, HOUR_END);

  if (clampedEnd <= clampedStart) return null;

  const totalHours = HOUR_END - HOUR_START;
  const top = ((clampedStart - HOUR_START) / totalHours) * 100;
  const height = ((clampedEnd - clampedStart) / totalHours) * 100;

  return { top, height: Math.max(height, 2) };
}

function EventBlock({ event, onClick, compact, currentTechnicianId }: { event: CalendarEvent; onClick: () => void; compact?: boolean; currentTechnicianId?: string | null }) {
  const colors = CALENDAR_PRIORITY_COLORS[event.priority] || CALENDAR_PRIORITY_COLORS.normal;
  const timeRange = event.scheduledStart
    ? `${formatTimeShort(event.scheduledStart)}${event.scheduledEnd ? ` - ${formatTimeShort(event.scheduledEnd)}` : ''}`
    : '';
  const clientName = event.clientSnapshot?.name || '';
  const address = event.locationSnapshot?.address || '';
  const isVisit = event.type === 'technical_visit';
  
  // Get assigned technician name
  const techName = isVisit 
    ? event.technician?.name || ''
    : event.technicians?.[0]?.name || '';
  
  // Check if event is assigned to current technician
  const isMyEvent = (() => {
    if (!currentTechnicianId) return false;
    if (isVisit) {
      return event.technician?._id === currentTechnicianId;
    }
    return event.technicians?.some(t => t._id === currentTechnicianId);
  })();
  
  // Get short number (last 7 chars for WO, last 7 for VT)
  const shortNumber = isVisit 
    ? (event as any).visitNumber?.slice(-7) || event.workOrderNumber?.slice(-7) || ''
    : event.workOrderNumber?.slice(-7) || '';
  
  // Different styling for OT vs VT
  const typeBadge = isVisit 
    ? { bg: 'bg-emerald-100 dark:bg-emerald-900/40', text: 'text-emerald-700 dark:text-emerald-300', label: 'VT' }
    : { bg: 'bg-blue-100 dark:bg-blue-900/40', text: 'text-blue-700 dark:text-blue-300', label: 'OT' };
  const typeColors = isVisit
    ? { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-800 dark:text-emerald-200' }
    : { border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-800 dark:text-blue-200' };

  // Priority badge
  const priorityInfo = (() => {
    switch (event.priority) {
      case 'urgent': return { label: 'Urgente', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
      case 'high': return { label: 'Alta', color: 'text-orange-600 dark:text-orange-400', bg: 'bg-orange-50 dark:bg-orange-900/20' };
      case 'normal': return { label: 'Normal', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
      default: return null;
    }
  })();

  // Status badge for unscheduled/draft items
  const statusInfo = (() => {
    if (!event.scheduledDate || event.scheduledDate === '') {
      switch (event.status) {
        case 'draft':
        case 'pending_assignment':
          return { label: 'Pendiente', color: 'text-gray-600 dark:text-slate-300', bg: 'bg-gray-100 dark:bg-slate-700' };
        case 'assigned':
          return { label: 'Asignada', color: 'text-indigo-600 dark:text-indigo-400', bg: 'bg-indigo-50 dark:bg-indigo-900/20' };
        case 'scheduled':
          return { label: 'Programada', color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20' };
        case 'in_progress':
          return { label: 'En Ejecución', color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-50 dark:bg-yellow-900/20' };
        case 'completed':
          return { label: 'Completada', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
        case 'closed':
          return { label: 'Cerrada', color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20' };
        case 'cancelled':
          return { label: 'Cancelada', color: 'text-red-600 dark:text-red-400', bg: 'bg-red-50 dark:bg-red-900/20' };
        default:
          return { label: 'Sin fecha', color: 'text-gray-500 dark:text-slate-400', bg: 'bg-gray-50 dark:bg-slate-800' };
      }
    }
    return null;
  })();

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-1.5 py-0.5 rounded border-l-2 ${typeColors.border} ${typeColors.bg} ${typeColors.text} hover:opacity-80 transition-opacity cursor-pointer`}
      >
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold">{shortNumber || typeBadge.label}</span>
          {isMyEvent && <span className="text-[8px] px-1 rounded bg-yellow-400 text-yellow-900 font-bold">MÍA</span>}
          {statusInfo && <span className={`text-[8px] px-1 rounded ${statusInfo.bg} ${statusInfo.color}`}>{statusInfo.label}</span>}
          {priorityInfo && <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.bg.replace('bg-', 'bg-').replace(/\/\d+/, '')}`} />}
        </div>
        {timeRange && <p className="text-[9px] truncate opacity-75">{timeRange}</p>}
        <p className="text-[9px] truncate opacity-75">{clientName}</p>
        {techName && <p className="text-[8px] truncate opacity-60">{techName}</p>}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 rounded border-l-2 ${typeColors.border} ${typeColors.bg} ${typeColors.text} hover:opacity-80 transition-opacity cursor-pointer`}
    >
      <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
        <span className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${typeBadge.bg} ${typeBadge.text}`}>
          {shortNumber || typeBadge.label}
        </span>
        {isMyEvent && (
          <span className="text-[8px] px-1.5 py-0.5 rounded bg-yellow-400 text-yellow-900 font-bold">
            MÍA ★
          </span>
        )}
        {statusInfo && (
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${statusInfo.bg} ${statusInfo.color}`}>
            {statusInfo.label}
          </span>
        )}
        {priorityInfo && (
          <span className={`text-[8px] px-1.5 py-0.5 rounded font-medium ${priorityInfo.bg} ${priorityInfo.color}`}>
            {priorityInfo.label}
          </span>
        )}
        {techName && (
          <span className="text-[8px] px-1 py-0.5 rounded bg-gray-100 dark:bg-slate-700 text-gray-600 dark:text-slate-300">
            {techName}
          </span>
        )}
      </div>
      {timeRange && <p className="text-[10px] font-medium">{timeRange}</p>}
      <p className="text-xs font-bold truncate">{event.title}</p>
      {clientName && <p className="text-[10px] truncate opacity-75">{clientName}</p>}
      {address && <p className="text-[9px] truncate opacity-60">{address}</p>}
    </button>
  );
}

function DayView({ events, date, onEventClick, currentTechnicianId }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void; currentTechnicianId?: string | null }) {
  const dayEvents = useMemo(() => getEventsForDay(events, date), [events, date]);
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = HOUR_START; h < HOUR_END; h++) arr.push(h);
    return arr;
  }, []);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="overflow-y-auto max-h-[600px]">
        <div className="relative">
          {hours.map((h) => (
            <div key={h} className="flex border-b border-gray-100 dark:border-slate-700" style={{ minHeight: '48px' }}>
              <div className="w-14 flex-shrink-0 text-[10px] text-gray-400 dark:text-slate-500 font-medium pr-2 pt-0.5 text-right">
                {formatHour(h)}
              </div>
              <div className="flex-1 border-l border-gray-100 dark:border-slate-700 px-1 py-0.5 min-h-[48px]" />
            </div>
          ))}

          <div className="absolute top-0 left-14 right-0 bottom-0 pointer-events-none">
            {dayEvents.map((event) => {
              const pos = getEventPosition(event);
              if (!pos) return null;
              return (
                <div
                  key={event._id}
                  className="absolute left-1 right-1 pointer-events-auto"
                  style={{ top: `${pos.top}%`, height: `${pos.height}%` }}
                >
                  <EventBlock event={event} onClick={() => onEventClick(event)} currentTechnicianId={currentTechnicianId} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({ events, date, onEventClick, currentTechnicianId }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void; currentTechnicianId?: string | null }) {
  const weekStart = useMemo(() => getWeekStart(date), [date]);
  const weekDays = useMemo(() => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      days.push(d);
    }
    return days;
  }, [weekStart]);

  const eventsByDay = useMemo(() => {
    return weekDays.map((day) => getEventsForDay(events, day));
  }, [events, weekDays]);

  const today = new Date();

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      {/* Week header - scrollable on small screens */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px] grid grid-cols-7 border-b border-gray-200 dark:border-slate-700">
          {weekDays.map((day, i) => {
            const isToday = isSameDay(day, today);
            return (
              <div key={i} className={`text-center py-2 border-r border-gray-100 dark:border-slate-700 last:border-r-0 ${isToday ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                <p className="text-[10px] text-gray-500 dark:text-slate-400 font-medium">{DAY_NAMES_SHORT[i]}</p>
                <p className={`text-lg font-bold ${isToday ? 'text-blue-600 dark:text-blue-400' : 'text-gray-900 dark:text-slate-100'}`}>
                  {day.getDate()}
                </p>
              </div>
            );
          })}
        </div>

        {/* Week body - scrollable */}
        <div className="overflow-x-auto">
          <div className="min-w-[600px] grid grid-cols-7 min-h-[300px] sm:min-h-[400px]">
            {weekDays.map((day, i) => {
              const dayEvts = eventsByDay[i];
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={`border-r border-gray-100 dark:border-slate-700 last:border-r-0 p-1 sm:p-2 ${isToday ? 'bg-blue-50/30 dark:bg-blue-900/10' : ''}`}
                >
                  <div className="space-y-1">
                    {dayEvts.length === 0 && (
                      <div className="h-6 sm:h-8" />
                    )}
                    {dayEvts.slice(0, 4).map((event) => (
                      <EventBlock
                        key={event._id}
                        event={event}
                        onClick={() => onEventClick(event)}
                        compact
                        currentTechnicianId={currentTechnicianId}
                      />
                    ))}
                    {dayEvts.length > 4 && (
                      <p className="text-[9px] text-gray-400 dark:text-slate-500 text-center font-medium">
                        +{dayEvts.length - 4}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function MonthView({ events, date, onEventClick, currentTechnicianId }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void; currentTechnicianId?: string | null }) {
  const today = new Date();
  const year = date.getFullYear();
  const month = date.getMonth();

  const calendarDays = useMemo(() => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startPad = firstDay.getDay();
    const totalDays = lastDay.getDate();

    const days: { date: Date; currentMonth: boolean }[] = [];

    for (let i = startPad - 1; i >= 0; i--) {
      const d = new Date(year, month, -i);
      days.push({ date: d, currentMonth: false });
    }
    for (let d = 1; d <= totalDays; d++) {
      days.push({ date: new Date(year, month, d), currentMonth: true });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ date: new Date(year, month + 1, d), currentMonth: false });
    }

    return days;
  }, [year, month]);

  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const key = startOfDay(parseLocalDate(e.scheduledDate)).toISOString();
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    });
    return map;
  }, [events]);

  return (
    <div className="bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700">
        {DAY_NAMES_SHORT.map((name) => (
          <div key={name} className="text-center py-2 text-[10px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
            {name}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {calendarDays.map(({ date: day, currentMonth }, i) => {
          const isToday = isSameDay(day, today);
          const key = startOfDay(day).toISOString();
          const dayEvts = eventsByDate.get(key) || [];

          return (
            <div
              key={i}
              className={`min-h-[72px] sm:min-h-[80px] border-b border-r border-gray-100 dark:border-slate-700 last:border-r-0 p-1 ${
                !currentMonth ? 'bg-gray-50/50 dark:bg-slate-800/50' : ''
              } ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''}`}
            >
              <p className={`text-xs font-medium mb-1 ${
                isToday ? 'text-blue-600 dark:text-blue-400 font-bold' : currentMonth ? 'text-gray-700 dark:text-slate-300' : 'text-gray-300 dark:text-slate-600'
              }`}>
                {day.getDate()}
              </p>
              <div className="space-y-0.5">
                {dayEvts.slice(0, 3).map((event) => {
                  const isVisit = event.type === 'technical_visit';
                  const shortNumber = isVisit 
                    ? (event as any).visitNumber?.slice(-7) || event.workOrderNumber?.slice(-7) || ''
                    : event.workOrderNumber?.slice(-7) || '';
                  const timeStr = event.scheduledStart 
                    ? new Date(event.scheduledStart).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })
                    : '';
                  const clientName = event.clientSnapshot?.name || '';
                  
                  // Different colors for OT vs VT
                  const typeColors = isVisit
                    ? { border: 'border-l-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/10', text: 'text-emerald-700 dark:text-emerald-300' }
                    : { border: 'border-l-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/10', text: 'text-blue-700 dark:text-blue-300' };
                  
                  return (
                    <button
                      key={event._id}
                      onClick={() => onEventClick(event)}
                      className={`w-full text-left px-1 py-0.5 rounded text-[9px] font-medium truncate border-l-2 ${typeColors.border} ${typeColors.bg} ${typeColors.text} hover:opacity-80 cursor-pointer`}
                    >
                      <span className="font-bold">{isVisit ? 'VT' : 'OT'}</span>
                      {timeStr && <span className="opacity-75"> {timeStr}</span>}
                      {' '}{shortNumber || clientName || event.title}
                    </button>
                  );
                })}
                {dayEvts.length > 3 && (
                  <p className="text-[9px] text-gray-400 dark:text-slate-500 text-center font-medium">
                    +{dayEvts.length - 3}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function CalendarView({ events, onEventClick, className = '', currentTechnicianId }: CalendarViewProps) {
  // Start with 'week' on server, then use useEffect to detect mobile after mount
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  // Detect mobile after mount to avoid hydration mismatch
  useEffect(() => {
    const checkMobile = () => {
      if (window.innerWidth < 768) {
        setViewMode('day');
      }
    };
    checkMobile();
  }, []);

  const navigateDate = useCallback((direction: -1 | 1) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day') d.setDate(d.getDate() + direction);
      else if (viewMode === 'week') {
        // Navigate from the start of the week, not from current date
        const ws = getWeekStart(d);
        ws.setDate(ws.getDate() + direction * 7);
        return ws;
      }
      else d.setMonth(d.getMonth() + direction);
      return d;
    });
  }, [viewMode]);

  const goToToday = useCallback(() => {
    setSelectedDate(new Date());
  }, []);

  const headerLabel = useMemo(() => {
    if (viewMode === 'day') {
      const today = new Date();
      const isToday = isSameDay(selectedDate, today);
      if (isToday) return 'Hoy';
      return `${DAY_NAMES_LONG[selectedDate.getDay()]} ${selectedDate.getDate()} de ${MONTH_NAMES[selectedDate.getMonth()]}`;
    }
    if (viewMode === 'week') {
      const ws = getWeekStart(selectedDate);
      const we = new Date(ws);
      we.setDate(we.getDate() + 6);
      if (ws.getMonth() === we.getMonth()) {
        return `${ws.getDate()} - ${we.getDate()} de ${MONTH_NAMES[ws.getMonth()]}`;
      }
      return `${ws.getDate()} ${MONTH_NAMES[ws.getMonth()].slice(0, 3)} - ${we.getDate()} ${MONTH_NAMES[we.getMonth()].slice(0, 3)}`;
    }
    return `${MONTH_NAMES[selectedDate.getMonth()]} ${selectedDate.getFullYear()}`;
  }, [viewMode, selectedDate]);

  return (
    <div className={`space-y-3 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900 dark:text-slate-100">Calendario</h2>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 dark:text-brand-400 border border-brand-200 dark:border-brand-800 rounded-lg hover:bg-brand-50 dark:hover:bg-brand-900/20 transition-colors"
          >
            Hoy
          </button>

          <div className="inline-flex rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'day' ? 'rounded-l-lg' : mode === 'month' ? 'rounded-r-lg border-l border-gray-200 dark:border-slate-600' : 'border-l border-gray-200 dark:border-slate-600'
                } ${
                  viewMode === mode
                    ? 'bg-gray-100 dark:bg-slate-700 text-gray-900 dark:text-slate-100'
                    : 'text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200'
                }`}
              >
                {VIEW_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <button
          onClick={() => navigateDate(-1)}
          className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <p className="text-sm font-semibold text-gray-900 dark:text-slate-100">{headerLabel}</p>
        <button
          onClick={() => navigateDate(1)}
          className="p-1.5 rounded-lg text-gray-500 dark:text-slate-400 hover:text-gray-700 dark:hover:text-slate-200 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {viewMode === 'day' && (
        <DayView events={events} date={selectedDate} onEventClick={onEventClick} currentTechnicianId={currentTechnicianId} />
      )}
      {viewMode === 'week' && (
        <WeekView events={events} date={selectedDate} onEventClick={onEventClick} currentTechnicianId={currentTechnicianId} />
      )}
      {viewMode === 'month' && (
        <MonthView events={events} date={selectedDate} onEventClick={onEventClick} currentTechnicianId={currentTechnicianId} />
      )}

      {events.length === 0 && (
        <div className="text-center py-8 bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-xl">
          <Calendar className="w-10 h-10 text-gray-300 dark:text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-medium text-gray-900 dark:text-slate-100">No hay eventos programados</p>
          <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">No se encontraron OTs en el calendario</p>
        </div>
      )}
    </div>
  );
}
