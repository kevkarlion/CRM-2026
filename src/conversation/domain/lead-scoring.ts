import type { ConversationContext } from './conversation';
import type { Temperature } from '../../leads/types/lead';

export interface ConversationScoringResult {
  score: number;
  temperature: Temperature;
  breakdown: {
    urgency: number;
    needClarity: number;
    customerType: number;
    location: number;
    equipmentType: number;
    emergencyBonus: number;
    projectBonus: number;
    humanRequestBonus: number;
  };
}

// Puntajes por nivel de urgencia
const URGENCY_SCORES: Record<string, number> = {
  high: 40,
  medium: 20,
  low: 5,
};

// Puntajes por claridad de necesidad
const NEED_CLARITY_SCORES: Record<string, number> = {
  repair: 20,
  installation: 20,
  maintenance: 20,
  spare_parts: 20,
  budget: 20,
  other: 5,
  general: 0,
};

// Puntajes por tipo de cliente
const CUSTOMER_TYPE_SCORES: Record<string, number> = {
  commercial: 15,
  residential: 10,
};

// Bonificaciones
const BONUS_EMERGENCY = 15;
const BONUS_PROJECT = 10;
const BONUS_HUMAN_REQUEST = 10;

export class ConversationLeadScoringService {
  /**
   * Calcula el score de una conversación basándose en el contexto acumulado.
   * Score va de 0 a ~120 (con bonuses).
   */
  calculateScore(context: ConversationContext): ConversationScoringResult {
    let score = 0;

    // Urgencia (0-40)
    const urgencyScore = context.urgency
      ? URGENCY_SCORES[context.urgency] ?? 0
      : 0;
    score += urgencyScore;

    // Claridad de necesidad (0-20)
    const needClarityScore = context.needType
      ? NEED_CLARITY_SCORES[context.needType] ?? 0
      : 0;
    score += needClarityScore;

    // Tipo de cliente (0-15)
    const customerTypeScore = context.customerType
      ? CUSTOMER_TYPE_SCORES[context.customerType] ?? 0
      : 0;
    score += customerTypeScore;

    // Ubicación proporcionada (0-10)
    const locationScore = context.location ? 10 : 0;
    score += locationScore;

    // Tipo de equipo proporcionado (0-10)
    const equipmentScore = context.equipmentType ? 10 : 0;
    score += equipmentScore;

    // Bonificaciones
    const emergencyBonus = context.hasEmergencyKeywords ? BONUS_EMERGENCY : 0;
    const projectBonus = context.hasProjectKeywords ? BONUS_PROJECT : 0;
    const humanRequestBonus = context.userAskedForHuman ? BONUS_HUMAN_REQUEST : 0;

    score += emergencyBonus + projectBonus + humanRequestBonus;

    const temperature = this.classify(score);

    return {
      score,
      temperature,
      breakdown: {
        urgency: urgencyScore,
        needClarity: needClarityScore,
        customerType: customerTypeScore,
        location: locationScore,
        equipmentType: equipmentScore,
        emergencyBonus,
        projectBonus,
        humanRequestBonus,
      },
    };
  }

  /**
   * Clasifica un score numérico en temperatura de lead
   */
  classify(score: number): Temperature {
    if (score >= 70) return 'hot';
    if (score >= 40) return 'warm';
    return 'cold';
  }
}
