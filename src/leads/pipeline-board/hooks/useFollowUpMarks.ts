'use client';

import { useState, useEffect, useCallback } from 'react';

export interface FollowUpMark {
  _id: string;
  tenantId: string;
  targetType: 'lead' | 'client';
  targetId: string;
  assignedTo: string;
  markedBy: string;
  note?: string;
  markedAt: string;
  // Populated target data when returned from API
  target?: {
    _id: string;
    name: string;
    status?: string;
    [key: string]: unknown;
  };
  markedByUser?: {
    _id: string;
    name: string;
    email: string;
  };
}

interface UseFollowUpMarksOptions {
  autoFetch?: boolean;
}

interface UseFollowUpMarksReturn {
  marks: FollowUpMark[];
  loading: boolean;
  error: string | null;
  fetchMarks: (userEmail: string) => Promise<void>;
  createMark: (data: {
    leadId?: string;
    clientId?: string;
    assignedTo: string;
    note?: string;
  }) => Promise<FollowUpMark | null>;
  deleteMark: (markId: string) => Promise<boolean>;
  isMarkedForUser: (targetType: 'lead' | 'client', targetId: string, userEmail: string) => FollowUpMark | undefined;
}

function getAuthHeaders(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  
  const token = localStorage.getItem('token');
  if (!token) return {};
  
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return {
      Authorization: `Bearer ${token}`,
      'x-tenant-id': payload.tenantId || 'default',
      'x-user-id': payload.userId || '',
    };
  } catch {
    return { Authorization: `Bearer ${token}` };
  }
}

export function useFollowUpMarks(options: UseFollowUpMarksOptions = {}): UseFollowUpMarksReturn {
  const { autoFetch = false } = options;
  
  const [marks, setMarks] = useState<FollowUpMark[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMarks = useCallback(async (userEmail: string) => {
    setLoading(true);
    setError(null);
    
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/follow-up-marks?userEmail=${encodeURIComponent(userEmail)}`, {
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      
      const data = await res.json();
      setMarks(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al cargar marcas de seguimiento');
      setMarks([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const createMark = useCallback(async (data: {
    leadId?: string;
    clientId?: string;
    assignedTo: string;
    note?: string;
  }): Promise<FollowUpMark | null> => {
    setError(null);
    
    try {
      const headers = getAuthHeaders();
      const res = await fetch('/api/follow-up-marks', {
        method: 'POST',
        headers: { ...headers, 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      
      const newMark = await res.json();
      setMarks(prev => [...prev, newMark]);
      return newMark;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear marca de seguimiento';
      setError(msg);
      throw err; // Re-throw so the modal can catch it
    }
  }, []);

  const deleteMark = useCallback(async (markId: string): Promise<boolean> => {
    setError(null);
    
    try {
      const headers = getAuthHeaders();
      const res = await fetch(`/api/follow-up-marks/${markId}`, {
        method: 'DELETE',
        headers: { ...headers, 'Content-Type': 'application/json' },
      });
      
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || `Error ${res.status}`);
      }
      
      setMarks(prev => prev.filter(m => m._id !== markId));
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al eliminar marca de seguimiento');
      return false;
    }
  }, []);

  const isMarkedForUser = useCallback((
    targetType: 'lead' | 'client',
    targetId: string,
    userEmail: string
  ): FollowUpMark | undefined => {
    return marks.find(m => 
      m.targetType === targetType && 
      m.targetId === targetId && 
      m.assignedTo === userEmail
    );
  }, [marks]);

  useEffect(() => {
    if (autoFetch) {
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const payload = JSON.parse(atob(token.split('.')[1]));
          if (payload.email) {
            fetchMarks(payload.email);
          }
        } catch {
          // Ignore token parse errors
        }
      }
    }
  }, [autoFetch, fetchMarks]);

  return {
    marks,
    loading,
    error,
    fetchMarks,
    createMark,
    deleteMark,
    isMarkedForUser,
  };
}
