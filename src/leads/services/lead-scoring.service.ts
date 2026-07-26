import { Types } from 'mongoose';
import type { InquiryReason, CustomerType, Temperature, ScoringBreakdown } from '../types/lead';

export interface ScoringInput {
  pushName?: string;
  inquiryReason?: InquiryReason;
  customerType?: CustomerType;
  messageText?: string;
}

export interface ScoringResult {
  score: number;
  temperature: Temperature;
  isB2B: boolean;
  breakdown: ScoringBreakdown;
  urgencyLevel: 'high' | 'medium' | 'low';
}

const B2B_KEYWORDS = [
  's.a.', 's.r.l.', 'gimnasio', 'hotel', 'local', 'estudio',
  'comercio', 'oficina', 'servicios', 'empresa', 'industria',
  'constructora', 'inmobiliaria', 'clínica', 'consultorio',
  'farmacia', 'supermercado', 'restaurant', 'bar', 'café',
  'techos', 'aire acondicionado', 'refrigeración', 'climatización',
];

const EMERGENCY_KEYWORDS = [
  'rompió', 'rompio', 'no enfría', 'no enfria', 'urgente',
  'sin aire', 'pierde agua', 'humo', 'calor', 'servidor',
  'falla', 'emergencia', 'rápido', 'rapido', 'ya', 'ahora',
  'no funciona', 'se quema', 'hace ruido', 'gotea',
];

const PROJECT_KEYWORDS = [
  'presupuesto', 'instalación', 'instalacion', 'cotizar',
  'compra', 'obra', 'equipos nuevos', 'equipo nuevo',
  'proyecto', 'remodelación', 'remodelacion', 'nuevo',
];

export class LeadScoringService {
  calculateScore(input: ScoringInput): ScoringResult {
    let score = 0;
    const breakdown: ScoringBreakdown = {
      buttons: 0,
      property: 0,
      keywords: 0,
      b2b: 0,
    };

    const isB2B = this.detectB2B(input.pushName);
    if (isB2B) {
      breakdown.b2b = 30;
      score += 30;
    }

    const buttonScore = this.scoreButtons(input.inquiryReason, input.customerType);
    breakdown.buttons = buttonScore.buttons;
    breakdown.property = buttonScore.property;
    score += buttonScore.buttons + buttonScore.property;

    const keywordScore = this.scoreKeywords(input.messageText);
    breakdown.keywords = keywordScore.score;
    score += keywordScore.score;

    const urgencyLevel = this.determineUrgency(
      input.inquiryReason,
      keywordScore.hasEmergencyKeywords
    );

    const temperature = this.determineTemperature(score, urgencyLevel);

    return {
      score,
      temperature,
      isB2B,
      breakdown,
      urgencyLevel,
    };
  }

  private detectB2B(pushName?: string): boolean {
    if (!pushName) return false;
    const lower = pushName.toLowerCase();
    return B2B_KEYWORDS.some(keyword => lower.includes(keyword));
  }

  private scoreButtons(
    inquiryReason?: InquiryReason,
    customerType?: CustomerType
  ): { buttons: number; property: number } {
    let buttons = 0;
    let property = 0;

    switch (inquiryReason) {
      case 'repair':
        buttons = 40;
        break;
      case 'installation':
        buttons = 30;
        break;
      case 'maintenance':
        buttons = 20;
        break;
      case 'budget':
        buttons = 10;
        break;
      default:
        buttons = 0;
    }

    if (customerType === 'commercial') {
      property = 20;
    }

    return { buttons, property };
  }

  private scoreKeywords(messageText?: string): {
    score: number;
    hasEmergencyKeywords: boolean;
    hasProjectKeywords: boolean;
  } {
    if (!messageText) {
      return { score: 0, hasEmergencyKeywords: false, hasProjectKeywords: false };
    }

    const lower = messageText.toLowerCase();
    const hasEmergencyKeywords = EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
    const hasProjectKeywords = PROJECT_KEYWORDS.some(kw => lower.includes(kw));

    let score = 0;
    if (hasEmergencyKeywords) score += 30;
    if (hasProjectKeywords) score += 15;

    return { score, hasEmergencyKeywords, hasProjectKeywords };
  }

  private determineUrgency(
    inquiryReason?: InquiryReason,
    hasEmergencyKeywords?: boolean
  ): 'high' | 'medium' | 'low' {
    if (hasEmergencyKeywords) return 'high';

    switch (inquiryReason) {
      case 'repair':
        return 'high';
      case 'installation':
        return 'medium';
      case 'maintenance':
      case 'budget':
      default:
        return 'low';
    }
  }

  private determineTemperature(
    score: number,
    urgencyLevel: 'high' | 'medium' | 'low'
  ): Temperature {
    if (score >= 80 || urgencyLevel === 'high') return 'hot';
    if (score >= 50) return 'warm';
    return 'cold';
  }
}

export default new LeadScoringService();
