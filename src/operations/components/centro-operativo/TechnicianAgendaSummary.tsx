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
  // Get type label and color
  const getTypeInfo = (type?: string) => {
    if (type === 'technical_visit') {
      return { label: 'VT', color: 'text-emerald-600', bg: 'bg-emerald-50', icon: '🔧' };
    }
    return { label: 'OT', color: 'text-blue-600', bg: 'bg-blue-50', icon: '📋' };
  };

  return (
    <div className={`bg-white border border-gray-200 rounded-xl p-3 sm:p-4 ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
              <span className="text-blue-600 font-bold text-sm">{todayCount}</span>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {todayCount === 1 ? 'trabajo hoy' : 'trabajos hoy'}
            </span>
          </div>

          <div className="w-px h-6 bg-gray-200" />

          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
              <span className="text-purple-600 font-bold text-sm">{weekCount}</span>
            </div>
            <span className="text-xs text-gray-500 whitespace-nowrap">
              {weekCount === 1 ? 'esta semana' : 'esta semana'}
            </span>
          </div>
        </div>

        {todayJobs && todayJobs.length > 0 && (
          <>
            <div className="hidden sm:block w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-2 min-w-0 overflow-x-auto">
              {todayJobs.slice(0, 3).map((job, idx) => {
                const typeInfo = getTypeInfo(job.type);
                return (
                  <div 
                    key={idx} 
                    className="flex items-center gap-2 min-w-0 flex-shrink-0"
                  >
                    {idx > 0 && <div className="w-px h-6 bg-gray-200" />}
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${typeInfo.bg} ${typeInfo.color}`}>
                          {typeInfo.icon} {typeInfo.label}
                        </span>
                        <p className="text-xs font-medium text-gray-900 truncate">{job.time}</p>
                      </div>
                      <p className="text-[10px] font-medium text-gray-900 truncate">{job.title}</p>
                      <p className="text-[9px] text-gray-500 truncate">
                        {job.technician ? `👤 ${job.technician}` : job.client}{job.address && ` • ${job.address}`}
                      </p>
                    </div>
                  </div>
                );
              })}
              {todayJobs.length > 3 && (
                <div className="text-[10px] text-gray-500 flex-shrink-0">
                  +{todayJobs.length - 3} más
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}