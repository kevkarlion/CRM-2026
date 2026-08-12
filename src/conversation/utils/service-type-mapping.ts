/**
 * Service Type Mapping Utility
 * 
 * Provides unified mapping between service types used in UI (states)
 * and the needType field used by scoring system.
 * 
 * Both lead and customer flows should use this to ensure consistent
 * scoring regardless of how the user responds (keyword or number).
 */

// Mapping from service state option numbers to service types
export const SERVICE_OPTION_MAP: Record<string, string> = {
  '1': 'maintenance',
  '2': 'repair',
  '3': 'spare_parts',
  '4': 'installation',
  '5': 'quote',
  '6': 'other',
};

// Human-readable labels for each service type
export const SERVICE_TYPE_LABELS: Record<string, string> = {
  maintenance: 'Mantenimiento',
  repair: 'Reparación',
  spare_parts: 'Repuestos',
  installation: 'Instalación',
  quote: 'Presupuesto',
  other: 'Otro',
};

/**
 * Maps a numeric option (1-6) to both serviceType and needType
 * Used by states to ensure scoring works regardless of input method
 * 
 * @param optionNum - The number selected by user (1-6)
 * @returns Object with serviceType, serviceTypeLabel, and needType for context
 */
export function mapServiceOption(optionNum: string): {
  serviceType: string;
  serviceTypeLabel: string;
  needType: string;
} | null {
  const serviceType = SERVICE_OPTION_MAP[optionNum];
  
  if (!serviceType) {
    return null;
  }
  
  return {
    serviceType,
    serviceTypeLabel: SERVICE_TYPE_LABELS[serviceType],
    needType: serviceType, // This is what scoring reads
  };
}

/**
 * Get service options array for display in UI
 * Returns options in canonical order: maintenance, repair, spare_parts, installation, quote, other
 * Note: Don't include number prefix - formatEngineMessage adds it automatically
 */
export function getServiceOptions(): string[] {
  return [
    '1️⃣ Mantenimiento',
    '2️⃣ Reparación',
    '3️⃣ Repuestos',
    '4️⃣ Instalación',
    '5️⃣ Cotización',
    '6️⃣ Otro',
  ];
}