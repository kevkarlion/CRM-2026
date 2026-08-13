import type { InquiryReason, CustomerType, Temperature, ScoringBreakdown } from '../types/lead';

/**
 * Calcula el score de un lead basado en los datos existentes.
 * NO requiere información adicional - usa solo los campos que el lead ya tiene.
 * Este scoring es para mostrar en el frontend cuando el lead pasa a "contactado".
 */
export function calculateLeadScore(lead: {
  inquiryReason?: InquiryReason;
  priority?: 'high' | 'medium' | 'low';
  customerType?: CustomerType;
  isB2B?: boolean;
  notes?: string;
}): { score: number; temperature: Temperature; breakdown: ScoringBreakdown } {
  let score = 0;
  const breakdown: ScoringBreakdown = {
    buttons: 0,
    property: 0,
    keywords: 0,
    b2b: 0,
  };

  // Inquiry Reason (tipo de servicio) - 0-40 puntos
  switch (lead.inquiryReason) {
    case 'repair':
      breakdown.buttons = 40;
      score += 40;
      break;
    case 'installation':
      breakdown.buttons = 30;
      score += 30;
      break;
    case 'maintenance':
      breakdown.buttons = 20;
      score += 20;
      break;
    case 'spare_parts':
      breakdown.buttons = 20;
      score += 20;
      break;
    case 'budget':
      breakdown.buttons = 10;
      score += 10;
      break;
    default:
      breakdown.buttons = 0;
  }

  // Priority (prioridad) - 0-40 puntos
  // La prioridad es el factor más importante
  switch (lead.priority) {
    case 'high':
      breakdown.keywords = 40; //复用keywords para priority
      score += 40;
      break;
    case 'medium':
      breakdown.keywords = 20;
      score += 20;
      break;
    case 'low':
      breakdown.keywords = 5;
      score += 5;
      break;
    default:
      breakdown.keywords = 0;
  }

  // Customer Type (tipo de cliente) - 0-20 puntos
  if (lead.customerType === 'commercial') {
    breakdown.property = 20;
    score += 20;
  } else if (lead.customerType === 'residential') {
    breakdown.property = 10;
    score += 10;
  }

  // B2B - 0-30 puntos
  if (lead.isB2B) {
    breakdown.b2b = 30;
    score += 30;
  }

  // Determinar temperatura
  let temperature: Temperature;
  if (score >= 70 || lead.priority === 'high') {
    temperature = 'hot';
  } else if (score >= 40) {
    temperature = 'warm';
  } else {
    temperature = 'cold';
  }

  console.log('[LeadScore] Calculated:', { score, temperature, inquiryReason: lead.inquiryReason, priority: lead.priority, customerType: lead.customerType });

  return { score, temperature, breakdown };
}

export default { calculateLeadScore };