import { User, MapPin } from 'lucide-react';

interface TechnicianAgendaSummaryProps {
  todayCount: number;
  weekCount: number;
  todayJobs?: { 
    type?: 'work_order' | 'technical_visit';
    title: string; 
    time: string; 
    client: string;
    address?: string;
    technician?: string;
  }[];
  className?: string;
}

export function TechnicianAgendaSummary({ todayCount, weekCount, todayJobs, className = '' }: TechnicianAgendaSummaryProps) {
  return (
    <div className={`bg-white dark:bg-slate-800/60 border border-gray-200 dark:border-slate-700 rounded-xl p-3 sm:p-4 ${className}`}>
      <div className="flex items-center gap-4">
        {/* Hoy: preponderante, es lo que se ve en el detalle */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div className="w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-sky-700 dark:text-sky-300 font-bold text-2xl leading-none">{todayCount}</span>
          </div>
          <div className="leading-tight">
            <span className="block text-base font-bold text-gray-900 dark:text-slate-100 whitespace-nowrap">
              {todayCount === 1 ? 'trabajo hoy' : 'trabajos hoy'}
            </span>
          </div>
        </div>

        <div className="w-px h-8 bg-gray-200 dark:bg-slate-600 flex-shrink-0" />

        {/* Esta semana: dato secundario */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-7 h-7 rounded-lg bg-violet-50 dark:bg-violet-500/20 flex items-center justify-center flex-shrink-0">
            <span className="text-violet-600 dark:text-violet-400 font-bold text-sm">{weekCount}</span>
          </div>
          <span className="text-xs text-gray-500 dark:text-slate-400 whitespace-nowrap">esta semana</span>
        </div>
      </div>

      {todayJobs && todayJobs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100 dark:border-slate-700">
          {/* Desktop table (sm+) */}
          <div className="hidden sm:block">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[10px] font-medium text-gray-500 dark:text-slate-400 uppercase tracking-wide">
                  <th className="text-left py-2 px-3 border-b border-gray-200 dark:border-slate-700">Hora</th>
                  <th className="text-left py-2 px-3 border-b border-gray-200 dark:border-slate-700">Trabajo</th>
                  <th className="text-left py-2 px-3 border-b border-gray-200 dark:border-slate-700">Técnico asignado</th>
                  <th className="text-left py-2 px-3 border-b border-gray-200 dark:border-slate-700">Dirección</th>
                </tr>
              </thead>
              <tbody>
                {todayJobs.map((job, idx) => {
                  const isVT = job.type === 'technical_visit';
                  return (
                    <tr key={idx} className="border-b border-gray-100 dark:border-slate-700 last:border-b-0 hover:bg-gray-50 dark:hover:bg-slate-700/40">
                      <td className="py-2 px-3 text-xs font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">{job.time}</td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white shrink-0 ${
                            isVT ? 'bg-teal-600' : 'bg-violet-600'
                          }`}>
                            {isVT ? 'VT' : 'OT'}
                          </span>
                          <span className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">{job.title}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <User className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                          <span className="text-xs text-gray-700 dark:text-slate-300 truncate">{job.technician || 'Sin asignar'}</span>
                        </div>
                      </td>
                      <td className="py-2 px-3">
                        {job.address ? (
                          <div className="flex items-center gap-1 min-w-0">
                            <MapPin className="w-3 h-3 shrink-0 text-gray-400 dark:text-slate-500" />
                            <span className="text-[11px] text-gray-500 dark:text-slate-400 truncate">{job.address}</span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-gray-400 dark:text-slate-500">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked list (<sm) */}
          <div className="sm:hidden space-y-2">
            {todayJobs.map((job, idx) => {
              const isVT = job.type === 'technical_visit';
              return (
                <div key={idx} className="bg-gray-50 dark:bg-slate-700/40 rounded-lg p-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${
                      isVT ? 'bg-teal-600' : 'bg-violet-600'
                    }`}>
                      {isVT ? 'VT' : 'OT'}
                    </span>
                    <span className="text-xs font-semibold text-gray-900 dark:text-slate-100 whitespace-nowrap">{job.time}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate mt-1">{job.title}</p>
                  <p className="flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-brand-700 dark:text-brand-400 truncate mt-1">
                    <User className="w-3.5 h-3.5 shrink-0 text-brand-500" />
                    <span className="truncate">Técnico asignado: {job.technician || 'Sin asignar'}</span>
                  </p>
                  {job.address && (
                    <p className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-slate-400 truncate">
                      <MapPin className="w-3 h-3 shrink-0 text-gray-400 dark:text-slate-500" />
                      <span className="truncate">{job.address}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}