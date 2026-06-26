export const DEFAULT_STAGES = [
  { name: 'Nuevo contacto', position: 0, probability: 10, isActive: true, mapsToStatus: 'new' as const },
  { name: 'Contactado', position: 1, probability: 25, isActive: true, mapsToStatus: 'contacted' as const },
  { name: 'Visita técnica', position: 2, probability: 50, isActive: true, mapsToStatus: 'qualified' as const },
  { name: 'Presupuesto', position: 3, probability: 75, isActive: true, mapsToStatus: 'qualified' as const },
  { name: 'Ganado', position: 4, probability: 100, isActive: true, mapsToStatus: 'won' as const },
];
