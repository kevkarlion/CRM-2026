'use client';

import { useState, useMemo, useCallback } from 'react';
import { CALENDAR_PRIORITY_COLORS } from '@/operations/constants/status-colors';
import { parseLocalDate } from '@/operations/helpers/date-utils';
import type { CalendarEvent, TechnicianWorkload } from '@/operations/types/centro-operativo';

type ViewMode = 'day' | 'week' | 'month';

interface CalendarViewProps {
  events: CalendarEvent[];
  technicians?: TechnicianWorkload[];
  onEventClick: (event: CalendarEvent) => void;
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
  const day = r.getDay();
  r.setDate(r.getDate() - day);
  r.setHours(0, 0, 0, 0);
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

function EventBlock({ event, onClick, compact }: { event: CalendarEvent; onClick: () => void; compact?: boolean }) {
  const colors = CALENDAR_PRIORITY_COLORS[event.priority] || CALENDAR_PRIORITY_COLORS.normal;
  const timeRange = event.scheduledStart
    ? `${formatTimeShort(event.scheduledStart)}${event.scheduledEnd ? ` - ${formatTimeShort(event.scheduledEnd)}` : ''}`
    : '';
  const clientName = event.clientSnapshot?.name || '';
  const techName = event.technicians?.[0]?.name || '';

  if (compact) {
    return (
      <button
        onClick={onClick}
        className={`w-full text-left px-1.5 py-0.5 rounded border-l-2 ${colors.bg} ${colors.border} ${colors.text} hover:opacity-80 transition-opacity cursor-pointer`}
      >
        <p className="text-[10px] font-bold truncate">
          {event.type === 'technical_visit' && <span className="text-emerald-600">🔧 </span>}
          {event.workOrderNumber}
        </p>
        <p className="text-[9px] truncate opacity-75">{clientName}</p>
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 rounded border-l-2 ${colors.bg} ${colors.border} ${colors.text} hover:opacity-80 transition-opacity cursor-pointer`}
    >
      {timeRange && <p className="text-[10px] font-medium">{timeRange}</p>}
      <p className="text-xs font-bold truncate">
        {event.type === 'technical_visit' && <span className="text-emerald-600">🔧 </span>}
        #{event.workOrderNumber}
      </p>
      {clientName && <p className="text-[10px] truncate opacity-75">{clientName}</p>}
      {techName && <p className="text-[9px] truncate opacity-60">{techName}</p>}
    </button>
  );
}

function DayView({ events, date, onEventClick }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void }) {
  const dayEvents = useMemo(() => getEventsForDay(events, date), [events, date]);
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let h = HOUR_START; h < HOUR_END; h++) arr.push(h);
    return arr;
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-y-auto max-h-[600px]">
        <div className="relative">
          {hours.map((h) => (
            <div key={h} className="flex border-b border-gray-100" style={{ minHeight: '48px' }}>
              <div className="w-14 flex-shrink-0 text-[10px] text-gray-400 font-medium pr-2 pt-0.5 text-right">
                {formatHour(h)}
              </div>
              <div className="flex-1 border-l border-gray-100 px-1 py-0.5 min-h-[48px]" />
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
                  <EventBlock event={event} onClick={() => onEventClick(event)} />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function WeekView({ events, date, onEventClick }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void }) {
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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <div className="min-w-[700px]">
          <div className="grid grid-cols-7 border-b border-gray-200">
            {weekDays.map((day, i) => {
              const isToday = isSameDay(day, today);
              return (
                <div key={i} className={`text-center py-2 border-r border-gray-100 last:border-r-0 ${isToday ? 'bg-blue-50' : ''}`}>
                  <p className="text-[10px] text-gray-500 font-medium">{DAY_NAMES_SHORT[i]}</p>
                  <p className={`text-lg font-bold ${isToday ? 'text-blue-600' : 'text-gray-900'}`}>
                    {day.getDate()}
                  </p>
                </div>
              );
            })}
          </div>

          <div className="grid grid-cols-7 min-h-[400px]">
            {weekDays.map((day, i) => {
              const dayEvts = eventsByDay[i];
              const isToday = isSameDay(day, today);
              return (
                <div
                  key={i}
                  className={`border-r border-gray-100 last:border-r-0 p-1 ${isToday ? 'bg-blue-50/30' : ''}`}
                >
                  <div className="space-y-1">
                    {dayEvts.length === 0 && (
                      <div className="h-8" />
                    )}
                    {dayEvts.slice(0, 6).map((event) => (
                      <EventBlock
                        key={event._id}
                        event={event}
                        onClick={() => onEventClick(event)}
                        compact
                      />
                    ))}
                    {dayEvts.length > 6 && (
                      <p className="text-[9px] text-gray-400 text-center font-medium">
                        +{dayEvts.length - 6} más
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

function MonthView({ events, date, onEventClick }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void }) {
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
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <div className="grid grid-cols-7 border-b border-gray-200">
        {DAY_NAMES_SHORT.map((name) => (
          <div key={name} className="text-center py-2 text-[10px] font-medium text-gray-500 uppercase tracking-wide">
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
              className={`min-h-[72px] sm:min-h-[80px] border-b border-r border-gray-100 last:border-r-0 p-1 ${
                !currentMonth ? 'bg-gray-50/50' : ''
              } ${isToday ? 'bg-blue-50/40' : ''}`}
            >
              <p className={`text-xs font-medium mb-1 ${
                isToday ? 'text-blue-600 font-bold' : currentMonth ? 'text-gray-700' : 'text-gray-300'
              }`}>
                {day.getDate()}
              </p>
              <div className="space-y-0.5">
                {dayEvts.slice(0, 3).map((event) => {
                  const colors = CALENDAR_PRIORITY_COLORS[event.priority] || CALENDAR_PRIORITY_COLORS.normal;
                  return (
                    <button
                      key={event._id}
                      onClick={() => onEventClick(event)}
                      className={`w-full text-left px-1 py-0.5 rounded text-[9px] font-medium truncate border-l-2 ${colors.bg} ${colors.border} ${colors.text} hover:opacity-80 cursor-pointer`}
                    >
                      {event.workOrderNumber}
                    </button>
                  );
                })}
                {dayEvts.length > 3 && (
                  <p className="text-[9px] text-gray-400 text-center font-medium">
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

export function CalendarView({ events, onEventClick }: CalendarViewProps) {
  const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
  const [viewMode, setViewMode] = useState<ViewMode>(isMobile ? 'day' : 'week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());

  const navigateDate = useCallback((direction: -1 | 1) => {
    setSelectedDate((prev) => {
      const d = new Date(prev);
      if (viewMode === 'day') d.setDate(d.getDate() + direction);
      else if (viewMode === 'week') d.setDate(d.getDate() + direction * 7);
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
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-gray-900">Calendario</h2>

        <div className="flex items-center gap-2">
          <button
            onClick={goToToday}
            className="px-3 py-1.5 text-xs font-medium text-brand-600 border border-brand-200 rounded-lg hover:bg-brand-50 transition-colors"
          >
            Hoy
          </button>

          <div className="inline-flex rounded-lg border border-gray-200 bg-white">
            {(['day', 'week', 'month'] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  mode === 'day' ? 'rounded-l-lg' : mode === 'month' ? 'rounded-r-lg border-l border-gray-200' : 'border-l border-gray-200'
                } ${
                  viewMode === mode
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-500 hover:text-gray-700'
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
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
        </button>
        <p className="text-sm font-semibold text-gray-900">{headerLabel}</p>
        <button
          onClick={() => navigateDate(1)}
          className="p-1.5 rounded-lg text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      </div>

      {viewMode === 'day' && (
        <DayView events={events} date={selectedDate} onEventClick={onEventClick} />
      )}
      {viewMode === 'week' && (
        <WeekView events={events} date={selectedDate} onEventClick={onEventClick} />
      )}
      {viewMode === 'month' && (
        <MonthView events={events} date={selectedDate} onEventClick={onEventClick} />
      )}

      {events.length === 0 && (
        <div className="text-center py-8 bg-white border border-gray-200 rounded-xl">
          <svg className="w-10 h-10 text-gray-300 mx-auto mb-2" fill="none" viewBox="0 0 24 24" strokeWidth={1} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
          </svg>
          <p className="text-sm font-medium text-gray-900">No hay eventos programados</p>
          <p className="text-xs text-gray-500 mt-1">No se encontraron OTs en el calendario</p>
        </div>
      )}
    </div>
  );
}
