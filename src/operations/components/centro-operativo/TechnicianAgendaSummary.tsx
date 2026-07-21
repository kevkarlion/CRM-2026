interface TechnicianAgendaSummaryProps {
  todayCount: number;
  weekCount: number;
  nextJob?: { title: string; time: string; client: string };
}

export function TechnicianAgendaSummary({ todayCount, weekCount, nextJob }: TechnicianAgendaSummaryProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-xl p-3 sm:p-4">
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

        {nextJob && (
          <>
            <div className="hidden sm:block w-px h-6 bg-gray-200" />
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-2 h-2 rounded-full bg-green-500 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-medium text-gray-900 truncate">{nextJob.client}</p>
                <p className="text-[10px] text-gray-400">
                  {nextJob.time} &middot; {nextJob.title}
                </p>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
