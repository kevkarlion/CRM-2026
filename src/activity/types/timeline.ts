export interface TimelineCardProps {
  event: {
    _id: string;
    eventType: string;
    title: string;
    summary?: string;
    icon?: string;
    color?: string;
    entityType: string;
    entityId: string;
    metadata?: Record<string, unknown>;
    createdBy:
      | { _id: string; firstName?: string; lastName?: string; email?: string }
      | string;
    createdAt: string;
  };
}
