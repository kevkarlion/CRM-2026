'use client';

export function AuditLogSkeleton() {
  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50/80">
            <th className="w-14 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Fecha</th>
            <th className="min-w-[100px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Usuario</th>
            <th className="min-w-[80px] px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Entidad</th>
            <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Acción</th>
            <th className="w-20 px-2 py-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Detalle</th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 8 }).map((_, i) => (
            <tr
              key={i}
              className={`border-b border-gray-100 ${i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}`}
            >
              <td className="px-2 py-1.5"><div className="skeleton-text h-3 w-20 rounded" /></td>
              <td className="px-2 py-1.5"><div className="skeleton-text h-3 w-28 rounded" /></td>
              <td className="px-2 py-1.5"><div className="skeleton-text h-3 w-16 rounded" /></td>
              <td className="px-2 py-1.5"><div className="skeleton-text h-3 w-24 rounded" /></td>
              <td className="px-2 py-1.5"><div className="skeleton-text h-3 w-14 rounded" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function AuditLogSkeletonMobile() {
  return (
    <div className="sm:hidden space-y-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 animate-pulse space-y-3">
          <div className="flex justify-between items-start gap-2">
            <div className="space-y-1.5 flex-1">
              <div className="skeleton-text h-3 w-24 rounded" />
              <div className="skeleton-text h-4 w-32 rounded" />
            </div>
            <div className="skeleton h-5 w-16 rounded-md" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="skeleton-text h-2 w-12 rounded mb-1" />
              <div className="skeleton-text h-3 w-20 rounded" />
            </div>
            <div className="bg-gray-100 rounded-lg px-3 py-2">
              <div className="skeleton-text h-2 w-8 rounded mb-1" />
              <div className="skeleton-text h-3 w-16 rounded" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
