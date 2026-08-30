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
    <div className={`bg-white border border-gray-200 rounded-xl p-3 sm:p-4 ${className}`}>
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center flex-shrink-0">
            <span className="text-sky-600 font-bold text-sm">{todayCount}</span>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">
            {todayCount === 1 ? 'trabajo hoy' : 'trabajos hoy'}
          </span>
        </div>

        <div className="w-px h-6 bg-gray-200 flex-shrink-0" />

        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="w-8 h-8 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
            <span className="text-violet-600 font-bold text-sm">{weekCount}</span>
          </div>
          <span className="text-xs text-gray-500 whitespace-nowrap">esta semana</span>
        </div>
      </div>

      {todayJobs && todayJobs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {todayJobs.slice(0, 3).map((job, idx) => {
              const isVT = job.type === 'technical_visit';
              return (
                <div key={idx} className="bg-gray-50 rounded-lg p-2.5 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold text-white ${
                      isVT ? 'bg-teal-600' : 'bg-violet-600'
                    }`}>
                      {isVT ? 'VT' : 'OT'}
                    </span>
                    <span className="text-xs font-semibold text-gray-900 whitespace-nowrap">{job.time}</span>
                  </div>
                  <p className="text-xs font-medium text-gray-900 truncate mt-1">{job.title}</p>
                  <p className="flex items-center gap-1 text-[10px] text-gray-500 truncate mt-0.5">
                    <User className="w-3 h-3 shrink-0 text-gray-400" />
                    <span className="truncate">{job.technician || job.client}</span>
                  </p>
                  {job.address && (
                    <p className="flex items-center gap-1 text-[10px] text-gray-500 truncate">
                      <MapPin className="w-3 h-3 shrink-0 text-gray-400" />
                      <span className="truncate">{job.address}</span>
                    </p>
                  )}
                </div>
              );
            })}
          </div>
          {todayJobs.length > 3 && (
            <p className="mt-2 text-[10px] text-gray-500">
              +{todayJobs.length - 3} {todayJobs.length - 3 === 1 ? 'trabajo más hoy' : 'trabajos más hoy'}
            </p>
          )}
        </div>
      )}
    </div>
  );
}