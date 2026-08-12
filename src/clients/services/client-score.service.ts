import type { Temperature } from '@/leads/types/lead';

/**
 * Calcula el score de un cliente basado en los datos existentes.
 * Usa: customerType, status, operationStatus, source
 */
export function calculateClientScore(client: {
  customerType?: 'residential' | 'commercial' | 'industrial';
  status?: 'prospect' | 'active' | 'inactive' | 'blocked';
  operationStatus?: 'none' | 'quote_pending' | 'visit_scheduled' | 'sale_confirmed';
  source?: string;
  notes?: string;
}): { score: number; temperature: Temperature } {
  let score = 0;

  // Customer Type - 0-30 puntos
  switch (client.customerType) {
    case 'commercial':
      score += 30;
      break;
    case 'industrial':
      score += 25;
      break;
    case 'residential':
      score += 10;
      break;
  }

  // Status - 0-25 puntos
  switch (client.status) {
    case 'active':
      score += 25;
      break;
    case 'prospect':
      score += 15;
      break;
    case 'inactive':
      score += 5;
      break;
    case 'blocked':
      score += 0;
      break;
  }

  // Operation Status - 0-30 puntos
  switch (client.operationStatus) {
    case 'sale_confirmed':
      score += 30;
      break;
    case 'visit_scheduled':
      score += 20;
      break;
    case 'quote_pending':
      score += 15;
      break;
    case 'none':
      score += 0;
      break;
  }

  // Source - 0-15 puntos
  switch (client.source) {
    case 'whatsapp':
      score += 15; // Canal directo = más engagement
      break;
    case 'referral':
      score += 15; // Referido = más confianza
      break;
    case 'walk_in':
      score += 10;
      break;
    case 'call':
      score += 5;
      break;
    case 'form':
      score += 5;
      break;
    default:
      score += 0;
  }

  // Determinar temperatura
  let temperature: Temperature;
  if (score >= 70) {
    temperature = 'hot';
  } else if (score >= 40) {
    temperature = 'warm';
  } else {
    temperature = 'cold';
  }

  return { score, temperature };
}

export default { calculateClientScore };