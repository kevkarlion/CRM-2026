/**
 * Technician Colors - Sistema canónico de colores por técnico
 * 
 * IMPORTANTE: Este es el único lugar donde se definen los colores de los técnicos.
 * Usar en: mapa operativo, calendarios, dashboards, etc.
 * 
 * Formato: { technicianId: { color: '#hex', name: 'Nombre' } }
 */

import type { Types } from 'mongoose';

// Paleta de colores para técnicos (orden canónico)
const TECHNICIAN_PALETTE = [
  { color: '#2563eb', name: 'Lautaro' },     // blue
  { color: '#000000', name: 'Conrado' },     // black
  { color: '#dc2626', name: 'Carlos Rodríguez' },  // red
  { color: '#16a34a', name: 'Ana López' },          // green
  { color: '#d97706', name: 'Martín García' },       // amber
  { color: '#7c3aed', name: 'Sebastián Díaz' },     // violet
  { color: '#0891b2', name: 'Luis Martínez' },      // cyan
  { color: '#db2777', name: 'Pablo Sánchez' },      // pink
  { color: '#4f46e5', name: 'Jorge Torres' },       // indigo
  { color: '#059669', name: 'Miguel Fernández' },    // emerald
  { color: '#ea580c', name: 'Diego López' },         // orange
] as const;

export type TechnicianColor = typeof TECHNICIAN_PALETTE[number];

// Obtener color por índice (para cuando no se conoce el técnico por nombre)
export function getTechnicianColorByIndex(index: number): string {
  return TECHNICIAN_PALETTE[index % TECHNICIAN_PALETTE.length].color;
}

// Obtener color por nombre de técnico (búsqueda exacta o parcial)
export function getTechnicianColorByName(name: string | undefined): string | null {
  if (!name) return null;
  
  const lowerName = name.toLowerCase();
  
  // Búsqueda exacta
  const exactMatch = TECHNICIAN_PALETTE.find(t => 
    t.name.toLowerCase() === lowerName
  );
  if (exactMatch) return exactMatch.color;
  
  // Búsqueda parcial (contiene)
  const partialMatch = TECHNICIAN_PALETTE.find(t => 
    t.name.toLowerCase().includes(lowerName) || 
    lowerName.includes(t.name.toLowerCase())
  );
  if (partialMatch) return partialMatch.color;
  
  // Si no encuentra, usar hash del nombre para consistency
  return getColorByHash(name);
}

// Obtener color por ID de técnico
export function getTechnicianColorById(technicianId: string | undefined): string | null {
  if (!technicianId) return null;
  // Por ahora usamos hash del ID para consistencia
  return getColorByHash(technicianId);
}

// Generar color consistente usando hash
function getColorByHash(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = key.charCodeAt(i) + ((hash << 5) - hash);
  }
  return TECHNICIAN_PALETTE[Math.abs(hash) % TECHNICIAN_PALETTE.length].color;
}

// Obtener todos los técnicos con sus colores (para leyendas, etc.)
export function getTechniciansWithColors(): TechnicianColor[] {
  return [...TECHNICIAN_PALETTE];
}

export default TECHNICIAN_PALETTE;
