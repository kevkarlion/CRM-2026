import type { ConversationState, ConversationContext } from './conversation';

export interface BotReply {
  content: string;
  options?: string[];
}

// Template de respuestas por estado
const STATE_REPLIES: Record<string, (ctx: ConversationContext) => BotReply> = {
  greeting: () => ({
    content: '¡Hola! Soy el asistente de Rolo Climatización. ¿En qué puedo ayudarte? 🌡️',
  }),

  need_type_asked: () => ({
    content: '¿Qué tipo de servicio necesitas? Puedo ayudarte con:\n\n1️⃣ Reparación\n2️⃣ Instalación\n3️⃣ Mantenimiento\n4️⃣ Presupuesto',
    options: ['Reparación', 'Instalación', 'Mantenimiento', 'Presupuesto'],
  }),

  detail_asked: (ctx) => {
    const needLabel = getNeedLabel(ctx.needType);
    return {
      content: `Perfecto, ${needLabel}. ¿Podrías darme más detalles sobre tu caso? Por ejemplo, qué equipo es, qué problema tenés, etc.`,
    };
  },

  urgency_asked: () => ({
    content: '¿Qué tan urgente es tu necesidad?\n\n🔴 Urgente (hoy)\n🟡 Esta semana\n🟢 No es urgente',
    options: ['Urgente', 'Esta semana', 'No es urgente'],
  }),

  location_asked: () => ({
    content: '¿En qué zona o dirección se encuentra el equipo? 📍',
  }),

  equipment_asked: () => ({
    content: '¿Qué tipo de equipo necesitas? Por ejemplo:\n\n❄️ Aire acondicionado\n🔥 Calefacción\n🌀 Ventilación\n🔧 Refrigeración',
    options: ['Aire acondicionado', 'Calefacción', 'Ventilación', 'Refrigeración'],
  }),

  handoff: (_ctx) => ({
    content: 'Perfecto, te voy a conectar con un especialista. Un momento por favor... 👨‍🔧',
  }),

  timeout: () => ({
    content: 'Parece que hubo un problema de conexión. Te voy a conectar con un asistente humano para ayudarte mejor. 👨‍💼',
  }),

  fallback: () => ({
    content: 'Disculpá, no entendí bien tu mensaje. ¿Podrías reformularlo? Por ejemplo, contame qué servicio necesitás.',
  }),
};

/**
 * Traduce el InquiryReason a etiqueta legible en español
 */
function getNeedLabel(needType?: string): string {
  const LABELS: Record<string, string> = {
    repair: 'para reparación',
    installation: 'para instalación',
    maintenance: 'para mantenimiento',
    budget: 'para presupuesto',
    other: 'que necesitás',
    general: 'que necesitás',
  };
  return LABELS[needType ?? ''] || 'que necesitás';
}

export class BotReplyComposer {
  /**
   * Compone una respuesta del bot basándose en el estado actual y el contexto
   */
  compose(state: ConversationState, context: ConversationContext): BotReply {
    // Si el estado tiene template definido, usarlo
    const templateFn = STATE_REPLIES[state];
    if (templateFn) {
      return templateFn(context);
    }

    // Fallback genérico para estados sin template
    return {
      content: 'Un momento por favor...',
    };
  }

  /**
   * Compone respuesta para handoff a humano
   */
  composeForHandoff(reason: string): BotReply {
    const reasons: Record<string, string> = {
      'hot_lead': 'Veo que tu consulta es importante. Te voy a conectar directamente con un especialista.',
      'user_request': 'Por supuesto, te conecto con un asesor ahora mismo.',
      'bot_confusion': 'Disculpá, parece que no estoy logrando ayudarte bien. Te paso con un asesor.',
      'timeout': 'Hubo un problema de conexión. Te paso con un asesor.',
      'stuck': 'Parece que necesitás ayuda más personalizada. Te conecto con un especialista.',
    };

    return {
      content: reasons[reason] || 'Te voy a conectar con un asesor especializado. Un momento...',
    };
  }

  /**
   * Compone respuesta de timeout
   */
  composeTimeout(): BotReply {
    const emptyCtx: ConversationContext = {
      hasEmergencyKeywords: false,
      hasProjectKeywords: false,
      messageContainsData: false,
      userAskedForHuman: false,
    };
    return STATE_REPLIES.timeout(emptyCtx);
  }

  /**
   * Compone respuesta de fallback
   */
  composeFallback(): BotReply {
    const emptyCtx: ConversationContext = {
      hasEmergencyKeywords: false,
      hasProjectKeywords: false,
      messageContainsData: false,
      userAskedForHuman: false,
    };
    return STATE_REPLIES.fallback(emptyCtx);
  }
}
