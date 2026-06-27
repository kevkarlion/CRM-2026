import type { IPipelineStage } from '../../types/pipeline';

interface ColumnHeaderProps {
  stage: IPipelineStage;
  leadCount: number;
  isInvalidDrop?: boolean;
}

export function ColumnHeader({ stage, leadCount, isInvalidDrop }: ColumnHeaderProps) {
  return (
    <div
      className={`flex items-center justify-between px-3 py-2 rounded-t-lg border-b ${
        isInvalidDrop ? 'opacity-50 bg-red-50 border-red-200' : 'bg-gray-50 border-gray-200'
      }`}
      aria-live="polite"
    >
      <div className="flex items-center gap-2 min-w-0">
        <h3 className="text-sm font-semibold text-gray-800 truncate">{stage.name}</h3>
        <span className="badge badge-neutral text-xs shrink-0">{leadCount}</span>
      </div>
      {stage.probability != null && (
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="w-12 h-1.5 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-brand-500 rounded-full transition-all"
              style={{ width: `${stage.probability}%` }}
            />
          </div>
          <span className="text-[10px] font-medium text-gray-500">{stage.probability}%</span>
        </div>
      )}
      {isInvalidDrop && (
        <span className="text-[10px] text-red-600 font-medium ml-1 shrink-0">
          Movimiento no válido
        </span>
      )}
    </div>
  );
}
