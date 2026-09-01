'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Calendar, User, MapPin } from 'lucide-react';
import { Drawer } from '@/lib/components/Drawer';
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

// Alternate background tints by column index so side-by-side events in the
// day view read as distinct blocks. Static classes (never built dynamically)
// so Tailwind's content scan keeps them.
const COLUMN_TINTS = [
  'bg-sky-100 dark:bg-sky-900/30',
  'bg-violet-100 dark:bg-violet-900/30',
  'bg-amber-100 dark:bg-amber-900/30',
  'bg-teal-100 dark:bg-teal-900/30',
  'bg-rose-100 dark:bg-rose-900/30',
  'bg-indigo-100 dark:bg-indigo-900/30',
];

const TECH_TINTS = [
  'bg-violet-100 dark:bg-violet-900/40',
  'bg-teal-100 dark:bg-teal-900/40',
  'bg-amber-100 dark:bg-amber-900/40',
  'bg-rose-100 dark:bg-rose-900/40',
  'bg-sky-100 dark:bg-sky-900/40',
  'bg-emerald-100 dark:bg-emerald-900/40',
  'bg-indigo-100 dark:bg-indigo-900/40',
  'bg-pink-100 dark:bg-pink-900/40',
];

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0;
  }
  return hash;
}

// Manual per-technician assignments take priority over the hash fallback.
// Key = technician name exactly as it appears in the data (case-sensitive).
const TECH_NAME_TINTS: Record<string, string> = {
  Conrado: 'bg-emerald-100 dark:bg-emerald-900/40',
};

function techTintFor(name: string): string {
  if (TECH_NAME_TINTS[name]) return TECH_NAME_TINTS[name];
  return TECH_TINTS[Math.abs(hashString(name)) % TECH_TINTS.length];
}

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

function EventBlock({ event, onClick, compact, currentTechnicianId, column = 0, totalColumns = 1, tintBase = 0 }: { event: CalendarEvent; onClick: () => void; compact?: boolean; currentTechnicianId?: string | null; column?: number; totalColumns?: number; tintBase?: number }) {
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

  // Color per technician: deterministic tint based on technician name.
  // Unassigned events get a fixed red-rose so they read as their own
  // category and never match an assigned technician's color.
  const bg = techName
    ? techTintFor(techName)
    : 'bg-rose-100 dark:bg-rose-900/40';

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
        className={`w-full text-left px-1.5 py-0.5 rounded border-l-2 ${typeColors.border} ${bg} ${typeColors.text} hover:opacity-80 transition-opacity cursor-pointer`}
      >
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-bold">{shortNumber || typeBadge.label}</span>
          {isMyEvent && <span className="text-[8px] px-1 rounded bg-yellow-400 text-yellow-900 font-bold">MÍA</span>}
          {statusInfo && <span className={`text-[8px] px-1 rounded ${statusInfo.bg} ${statusInfo.color}`}>{statusInfo.label}</span>}
          {priorityInfo && <span className={`w-1.5 h-1.5 rounded-full ${priorityInfo.bg.replace('bg-', 'bg-').replace(/\/\d+/, '')}`} />}
        </div>
        {timeRange && (
          <p className={`inline-block text-[10px] font-bold tracking-wide rounded px-1 py-0.5 mt-0.5 ${typeColors.text} bg-white/70 dark:bg-slate-950/40`}>
            {timeRange}
          </p>
        )}
        <p className="text-[9px] truncate opacity-75 mt-0.5">{clientName}</p>
        {techName && (
          <p className="text-[11px] font-semibold text-gray-700 dark:text-slate-300 truncate">
            <User className="inline w-3.5 h-3.5 shrink-0 text-gray-400 dark:text-slate-500 mr-0.5" /> {techName}
          </p>
        )}
      </button>
    );
  }

  return (
    <button
      onClick={onClick}
      className={`w-full text-left px-2 py-1 rounded border-l-2 ${typeColors.border} ${bg} ${typeColors.text} hover:opacity-80 transition-opacity cursor-pointer`}
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
      </div>
      <p className="text-xs font-bold truncate">{event.title}</p>
      {techName && (
        <p className="text-[13px] font-bold text-gray-800 dark:text-slate-100 truncate mt-0.5">
          <User className="inline w-4 h-4 shrink-0 text-brand-500 mr-1" /> {techName}
        </p>
      )}
      {timeRange && (
        <p className={`inline-block text-[11px] font-bold tracking-wide rounded px-1.5 py-0.5 mt-0.5 mb-1 ${typeColors.text} bg-white/70 dark:bg-slate-950/40`}>
          {timeRange}
        </p>
      )}
      {clientName && <p className="text-[10px] truncate opacity-75">{clientName}</p>}
      {address && <p className="text-[9px] truncate opacity-60">{address}</p>}
    </button>
  );
}

interface PositionedEvent {
  event: CalendarEvent;
  top: number;
  height: number;
  column: number;
  totalColumns: number;
  tintBase: number;
}

function eventsOverlap(a: CalendarEvent, b: CalendarEvent): boolean {
  const posA = getEventPosition(a);
  const posB = getEventPosition(b);
  if (!posA || !posB) return false;
  return posA.top < posB.top + posB.height && posB.top < posA.top + posA.height;
}

function layoutDayEvents(events: CalendarEvent[]): PositionedEvent[] {
  if (events.length === 0) return [];

  // 1. Sort by scheduledStart (earliest first)
  const sorted = [...events].sort((a, b) => {
    const aTime = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
    const bTime = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
    return aTime - bTime;
  });

  // 2. Group into overlapping clusters (transitive closure).
  //    Sweep through sorted events; each event extends any existing
  //    cluster whose last event overlaps with it, otherwise starts a new cluster.
  const clusters: CalendarEvent[][] = [];
  for (const event of sorted) {
    let placed = false;
    for (const cluster of clusters) {
      // Check if this event overlaps with any event already in the cluster
      if (cluster.some((e) => eventsOverlap(e, event))) {
        cluster.push(event);
        placed = true;
        break;
      }
    }
    if (!placed) {
      clusters.push([event]);
    }
  }

  // Merge clusters that became transitively connected via a later event.
  // If cluster B's event overlaps with cluster A's event, merge B into A.
  let merged = true;
  while (merged) {
    merged = false;
    for (let i = 0; i < clusters.length; i++) {
      for (let j = i + 1; j < clusters.length; j++) {
        const crossOverlap = clusters[i].some((ei) =>
          clusters[j].some((ej) => eventsOverlap(ei, ej))
        );
        if (crossOverlap) {
          clusters[i].push(...clusters[j]);
          clusters.splice(j, 1);
          merged = true;
          break;
        }
      }
      if (merged) break;
    }
  }

  // 3. For each cluster, assign column indices using a greedy algorithm:
  //    - Iterate events sorted by start time.
  //    - Track which columns are currently occupied by ongoing events.
  //    - For each event, pick the lowest-numbered free column.
  //    - Release columns when their events end.
  // 4. Assign a tint "tanda" (tintBase) across the whole day so that
  //    chronologically consecutive, non-overlapping events get DIFFERENT
  //    colors even when they share the same column (greedy reuses column 0
  //    for back-to-back events). tintBase increments whenever an event does
  //    not overlap the previous event in sorted order.
  const result: PositionedEvent[] = [];
  let dayTint = 0;
  let prevEvent: CalendarEvent | null = null;
  for (const cluster of clusters) {
    const clusterSorted = [...cluster].sort((a, b) => {
      const aTime = a.scheduledStart ? new Date(a.scheduledStart).getTime() : 0;
      const bTime = b.scheduledStart ? new Date(b.scheduledStart).getTime() : 0;
      return aTime - bTime;
    });

    // Track: column index → end position (% height) of the event occupying it
    const occupied: { column: number; endsAt: number }[] = [];
    const assignments = new Map<CalendarEvent, number>();

    for (const event of clusterSorted) {
      const pos = getEventPosition(event);
      if (!pos) continue;

      // Advance the day-wide cycle when this event doesn't overlap the previous one
      if (prevEvent && !eventsOverlap(prevEvent, event)) {
        dayTint += 1;
      }

      // Release columns whose events have ended before this one starts
      const filtered = occupied.filter((o) => o.endsAt > pos.top);
      occupied.length = 0;
      occupied.push(...filtered);

      // Find lowest free column
      const usedColumns = new Set(occupied.map((o) => o.column));
      let col = 0;
      while (usedColumns.has(col)) col++;

      occupied.push({ column: col, endsAt: pos.top + pos.height });
      assignments.set(event, col);
      prevEvent = event;
    }

    const totalColumns = Math.max(
      1,
      // Guard against >4 columns — clamp visual width but don't crash
      Math.max(...Array.from(assignments.values()).map((c) => c + 1), 1)
    );

    for (const [event, col] of assignments) {
      const pos = getEventPosition(event);
      if (!pos) continue;
      result.push({
        event,
        top: pos.top,
        height: pos.height,
        column: col,
        totalColumns,
        tintBase: dayTint,
      });
    }
  }

  return result;
}

function DayView({ events, date, onEventClick, currentTechnicianId }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void; currentTechnicianId?: string | null }) {
  const dayEvents = useMemo(() => getEventsForDay(events, date), [events, date]);
  const positioned = useMemo(() => layoutDayEvents(dayEvents), [dayEvents]);
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
            {positioned.map(({ event, top, height, column, totalColumns, tintBase }) => {
              const widthPct = totalColumns === 1 ? 100 : 100 / totalColumns;
              const leftPct = totalColumns === 1 ? 0 : column * (100 / totalColumns);
              const gutterPx = totalColumns > 1 ? 1 : 0;
              return (
                <div
                  key={event._id}
                  className="absolute pointer-events-auto overflow-hidden"
                  style={{
                    top: `${top}%`,
                    height: `${height}%`,
                    left: `calc(${leftPct}% + ${gutterPx}px)`,
                    width: `calc(${widthPct}% - ${gutterPx}px)`,
                  }}
                >
                  <EventBlock event={event} onClick={() => onEventClick(event)} currentTechnicianId={currentTechnicianId} column={column} totalColumns={totalColumns} tintBase={tintBase} />
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
      {/* Contenedor único con scroll horizontal para mantener header y body sincronizados */}
      <div className="overflow-x-auto">
        <div className="min-w-[600px]">
          {/* Week header */}
          <div className="grid grid-cols-7 border-b border-gray-200 dark:border-slate-700">
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

          {/* Week body */}
          <div className="grid grid-cols-7 min-h-[300px] sm:min-h-[400px]">
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
                    {dayEvts.map((event) => (
                      <EventBlock
                        key={event._id}
                        event={event}
                        onClick={() => onEventClick(event)}
                        compact
                        currentTechnicianId={currentTechnicianId}
                      />
                    ))}
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

function MonthView({ events, date, onEventClick, currentTechnicianId, onDayClick }: { events: CalendarEvent[]; date: Date; onEventClick: (event: CalendarEvent) => void; currentTechnicianId?: string | null; onDayClick: (day: Date) => void }) {
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
              } ${isToday ? 'bg-blue-50/40 dark:bg-blue-900/10' : ''} ${
                dayEvts.length > 0 && currentMonth ? 'cursor-pointer hover:ring-1 hover:ring-brand-300 dark:hover:ring-brand-600 transition-shadow' : ''
              }`}
              onClick={dayEvts.length > 0 && currentMonth ? () => onDayClick(day) : undefined}
              role={dayEvts.length > 0 && currentMonth ? 'button' : undefined}
              tabIndex={dayEvts.length > 0 && currentMonth ? 0 : undefined}
              onKeyDown={dayEvts.length > 0 && currentMonth ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onDayClick(day); } } : undefined}
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
                      onClick={(e) => { e.stopPropagation(); onEventClick(event); }}
                      className={`w-full text-left px-1 py-0.5 rounded text-[9px] font-medium truncate border-l-2 ${typeColors.border} ${typeColors.bg} ${typeColors.text} hover:opacity-80 cursor-pointer`}
                    >
                      <span className="font-bold">{isVisit ? 'VT' : 'OT'}</span>
                      {timeStr && <span className="opacity-75"> {timeStr}</span>}
                      {' '}{shortNumber || clientName || event.title}
                    </button>
                  );
                })}
                {dayEvts.length > 3 && (
                  <p className="text-[9px] text-brand-600 dark:text-brand-400 text-center font-semibold hover:underline cursor-pointer" onClick={(e) => { e.stopPropagation(); onDayClick(day); }}>
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

function DayDetailDrawer({ day, events, onEventClick, onClose, currentTechnicianId }: { day: Date; events: CalendarEvent[]; onEventClick: (event: CalendarEvent) => void; onClose: () => void; currentTechnicianId?: string | null }) {
  const dayEvents = useMemo(() => getEventsForDay(events, day), [events, day]);
  const dayLabel = `${DAY_NAMES_LONG[day.getDay()]} ${day.getDate()} de ${MONTH_NAMES[day.getMonth()]}`;

  return (
    <Drawer isOpen onClose={onClose} title={`${dayLabel} — ${dayEvents.length} ${dayEvents.length === 1 ? 'trabajo' : 'trabajos'}`}>
      <div className="space-y-2">
        {dayEvents.length === 0 ? (
          <p className="text-sm text-gray-500 dark:text-slate-400 text-center py-8">No hay trabajos programados para este día.</p>
        ) : (
          dayEvents.map((event) => {
            const isVT = event.type === 'technical_visit';
            const shortNumber = isVT
              ? (event as any).visitNumber?.slice(-7) || event.workOrderNumber?.slice(-7) || ''
              : event.workOrderNumber?.slice(-7) || '';
            const timeStr = formatTimeShort(event.scheduledStart);
            const clientName = event.clientSnapshot?.name || '';
            const address = event.locationSnapshot?.address || '';
            const techName = isVT ? event.technician?.name || '' : event.technicians?.[0]?.name || '';

            const typeBadge = isVT
              ? { bg: 'bg-teal-600', label: 'VT' }
              : { bg: 'bg-violet-600', label: 'OT' };

            return (
              <button
                key={event._id}
                onClick={() => { onEventClick(event); onClose(); }}
                className="w-full text-left p-3 rounded-lg border border-gray-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white shrink-0 ${typeBadge.bg}`}>
                    {typeBadge.label}
                  </span>
                  {shortNumber && (
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 font-mono">{shortNumber}</span>
                  )}
                  {timeStr && (
                    <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 ml-auto whitespace-nowrap">{timeStr}</span>
                  )}
                </div>
                <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{event.title}</p>
                {clientName && <p className="text-[11px] text-gray-500 dark:text-slate-400 truncate mt-0.5">{clientName}</p>}
                {address && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3 shrink-0 text-gray-400" />
                    <span className="text-[10px] text-gray-500 dark:text-slate-400 truncate">{address}</span>
                  </div>
                )}
                {techName && (
                  <p className="flex items-center gap-1 text-[10px] font-semibold text-brand-700 dark:text-brand-400 truncate mt-1">
                    <User className="w-3 h-3 shrink-0" />
                    <span className="truncate">Técnico asignado: {techName}</span>
                  </p>
                )}
              </button>
            );
          })
        )}
      </div>
    </Drawer>
  );
}

export function CalendarView({ events, onEventClick, className = '', currentTechnicianId }: CalendarViewProps) {
  // Start with 'week' on server, then use useEffect to detect mobile after mount
  const [viewMode, setViewMode] = useState<ViewMode>('week');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

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
        <MonthView events={events} date={selectedDate} onEventClick={onEventClick} currentTechnicianId={currentTechnicianId} onDayClick={setSelectedDay} />
      )}

      {selectedDay && (
        <DayDetailDrawer
          day={selectedDay}
          events={events}
          onEventClick={onEventClick}
          onClose={() => setSelectedDay(null)}
          currentTechnicianId={currentTechnicianId}
        />
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
