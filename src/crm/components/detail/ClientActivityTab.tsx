'use client';

import { ClientTimeline } from '@/activity/components/LeadTimeline';

interface ClientActivityTabProps {
  clientId: string;
  refreshKey?: number;
}

export function ClientActivityTab({ clientId, refreshKey = 0 }: ClientActivityTabProps) {
  return <ClientTimeline clientId={clientId} refreshKey={refreshKey} />;
}
