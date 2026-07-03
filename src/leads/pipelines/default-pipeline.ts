export const DEFAULT_STAGES = [
  { name: 'Nuevo contacto', position: 0, probability: 10, isActive: true, mapsToStatus: 'new' as const },
  { name: 'Contactado', position: 1, probability: 25, isActive: true, mapsToStatus: 'contacted' as const },
  { name: 'Visita técnica', position: 2, probability: 40, isActive: true, mapsToStatus: 'technical_visit' as const },
  { name: 'Presupuesto enviado', position: 3, probability: 60, isActive: true, mapsToStatus: 'quote_sent' as const },
  { name: 'Negociación', position: 4, probability: 80, isActive: true, mapsToStatus: 'negotiation' as const },
  { name: 'Ganado', position: 5, probability: 100, isActive: true, mapsToStatus: 'won' as const },
];
