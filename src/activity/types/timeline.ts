export interface TimelineEvent {
  _id: string;
  tenantId: string;
  entityType: string;
  entityId: string;
  eventType: string;
  title: string;
  summary?: string;
  icon?: string;
  color?: string;
  createdBy: { _id: string; firstName?: string; lastName?: string; email?: string } | string;
  createdAt: string;
  metadata?: Record<string, unknown>;
}

export interface TimelineCardProps {
  event: TimelineEvent;
}
