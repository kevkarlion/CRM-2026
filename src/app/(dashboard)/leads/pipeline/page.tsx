'use client';

import { Suspense } from 'react';
import PipelineBoard from '@/leads/pipeline-board';

export default function PipelinePage() {
  return (
    <div className="h-full overflow-hidden">
      <Suspense fallback={<div className="p-4 text-gray-400">Cargando...</div>}>
        <PipelineBoard />
      </Suspense>
    </div>
  );
}
