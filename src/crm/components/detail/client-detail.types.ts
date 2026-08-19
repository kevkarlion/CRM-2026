import type { QuoteStatus } from '@/quotes/types/quote';
import type { BlockHistoryEntry } from '@/crm/types/client';

/** Active Gestion info for client detail */
export interface ActiveGestionInfo {
  _id: string;
  status: string;
  name: string;
  createdAt: string;
}

/** Client as returned by GET /api/crm/clients/:id. */
export interface ClientDetail {
  _id: string;
  customerType: string;
  status: string;
  fullName?: string;
  companyName?: string;
  taxId?: string;
  email?: string;
  phone?: string;
  address?: string;
  locality?: string;
  province?: string;
  source?: string;
  notes?: string;
  tags: string[];
  blockHistory?: BlockHistoryEntry[];
  operationStatus?: string;
  createdAt: string;
  updatedAt: string;
  activeGestion?: ActiveGestionInfo | null;
}

/** Quote item from GET /api/crm/quotes?clientId=:id. */
export interface QuoteListItem {
  _id: string;
  number: string;
  title: string;
  total: number;
  status: QuoteStatus | string;
  validUntil?: string | null;
  createdAt?: string;
}
