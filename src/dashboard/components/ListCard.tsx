// ── List card — listado con items ──────────────────────────

import { ReactNode } from 'react';

interface ListItem {
  id: string;
  left: ReactNode;
  right?: ReactNode;
}

interface ListCardProps {
  items: ListItem[];
  emptyMessage?: string;
}

export function ListCard({ items, emptyMessage = 'Sin datos' }: ListCardProps) {
  if (items.length === 0) {
    return (
      <div className="list-card">
        <p className="text-sm text-gray-400 text-center py-8">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="list-card">
      {items.map((item) => (
        <div key={item.id} className="list-card-item">
          <div className="flex-1 min-w-0">{item.left}</div>
          {item.right && <div className="ml-3 flex-shrink-0">{item.right}</div>}
        </div>
      ))}
    </div>
  );
}
