'use client';

import { useState, useEffect } from 'react';
import { api } from '@/lib/api-client';

interface Technician {
  _id: string;
  name: string;
  email: string;
  phone: string;
  availability: 'available' | 'busy' | 'unavailable';
  specialties?: string[];
  activeAssignments: number;
  todayAssignments: number;
  completedToday: number;
  utilization: number;
}

interface TechnicianListProps {
  onTechnicianClick?: (technicianId: string) => void;
  showUtilization?: boolean;
}

export function TechnicianList({ 
  onTechnicianClick, 
  showUtilization = true 
}: TechnicianListProps) {
  const [technicians, setTechnicians] = useState<Technician[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'available' | 'busy' | 'unavailable'>('all');

  useEffect(() => {
    loadTechnicians();
  }, []);

  async function loadTechnicians() {
    try {
      setLoading(true);
      setError(null);
      const data = await api.get<Technician[]>('/api/operations/dashboard?view=technicians');
      setTechnicians(data);
    } catch (err) {
      console.error('Error loading technicians:', err);
      setError(err instanceof Error ? err.message : 'Error al cargar técnicos');
    } finally {
      setLoading(false);
    }
  }

  const filteredTechnicians = technicians.filter(tech => 
    filter === 'all' || tech.availability === filter
  );

  const getAvailabilityBadge = (availability: Technician['availability']) => {
    const styles = {
      available: 'bg-green-100 text-green-700 border-green-200',
      busy: 'bg-yellow-100 text-yellow-700 border-yellow-200',
      unavailable: 'bg-red-100 text-red-700 border-red-200',
    };
    const labels = {
      available: 'Disponible',
      busy: 'Ocupado',
      unavailable: 'No disponible',
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full border ${styles[availability]}`}>
        {labels[availability]}
      </span>
    );
  };

  const getUtilizationColor = (utilization: number) => {
    if (utilization >= 80) return 'bg-red-500';
    if (utilization >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-3">
        {[1, 2, 3].map(i => (
          <div key={i} className="h-20 bg-gray-200 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-700 text-sm">{error}</p>
        <button 
          onClick={loadTechnicians}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (technicians.length === 0) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center">
        <p className="text-gray-500 text-sm">No hay técnicos registrados</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {(['all', 'available', 'busy', 'unavailable'] as const).map(f => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 text-sm rounded-lg whitespace-nowrap transition-colors ${
              filter === f
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {f === 'all' ? 'Todos' : f === 'available' ? 'Disponibles' : f === 'busy' ? 'Ocupados' : 'No disponibles'}
            <span className="ml-1.5 text-xs opacity-70">
              ({f === 'all' ? technicians.length : technicians.filter(t => t.availability === f).length})
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-3">
        {filteredTechnicians.map(tech => (
          <div
            key={tech._id}
            onClick={() => onTechnicianClick?.(tech._id)}
            className={`bg-white border border-gray-200 rounded-lg p-4 transition-all ${
              onTechnicianClick ? 'cursor-pointer hover:border-gray-300 hover:shadow-sm' : ''
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                  <span className="text-lg font-medium text-gray-600">
                    {tech.name.charAt(0).toUpperCase()}
                  </span>
                </div>
                <div>
                  <h4 className="font-medium text-gray-900">{tech.name}</h4>
                  <p className="text-xs text-gray-500">{tech.phone}</p>
                </div>
              </div>
              {getAvailabilityBadge(tech.availability)}
            </div>

            <div className="grid grid-cols-3 gap-4 text-center">
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Hoy</p>
                <p className="text-lg font-bold text-gray-900">{tech.todayAssignments}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Activos</p>
                <p className="text-lg font-bold text-gray-900">{tech.activeAssignments}</p>
              </div>
              <div className="bg-gray-50 rounded-lg p-2">
                <p className="text-xs text-gray-500">Completados</p>
                <p className="text-lg font-bold text-green-600">{tech.completedToday}</p>
              </div>
            </div>

            {showUtilization && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>Utilización</span>
                  <span>{tech.utilization}%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all ${getUtilizationColor(tech.utilization)}`}
                    style={{ width: `${Math.min(tech.utilization, 100)}%` }}
                  />
                </div>
              </div>
            )}

            {tech.specialties && tech.specialties.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1">
                {tech.specialties.map((specialty, i) => (
                  <span 
                    key={i} 
                    className="px-2 py-0.5 bg-gray-100 text-gray-600 text-xs rounded"
                  >
                    {specialty}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}