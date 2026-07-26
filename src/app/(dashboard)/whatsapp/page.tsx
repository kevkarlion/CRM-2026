'use client';

import { Suspense } from 'react';
import { WhatsAppPage } from '@/whatsapp/components/WhatsAppPage';

export default function WhatsAppRoute() {
  return (
    <div className="h-full overflow-hidden">
      <Suspense fallback={<div className="p-4 text-gray-400">Cargando...</div>}>
        <WhatsAppPage />
      </Suspense>
    </div>
  );
}
