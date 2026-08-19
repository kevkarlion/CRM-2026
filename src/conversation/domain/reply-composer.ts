import type { ConversationState, ConversationContext } from './conversation';

export interface BotReply {
  content: string;
  options?: string[];
}

// Template de respuestas por estado
const STATE_REPLIES: Record<string, (ctx: ConversationContext) => BotReply> = {
  greeting: () => ({
    content: '¡Hola! Soy el asistente de Rolo Climatización S.R.L. ¿En qué puedo ayudarte? 🌡️',
  }),

  greeting_personalized: (ctx) => {
    // Get hour in Argentina timezone (UTC-3) - approximate by subtracting 3 from UTC
    const utcHour = new Date().getHours();
    const argentinaHour = (utcHour - 3 + 24) % 24;
    
    let greeting: string;
    if (argentinaHour >= 20 || argentinaHour < 6) {
      greeting = '🌙 Buenas noches';
    } else if (argentinaHour < 12) {
      greeting = '🌞 Buenos días';
    } else {
      greeting = '☀️ Buenas tardes';
    }

    const customerName = ctx.userName || ctx.profileName;
    const namePart = customerName ? ` ${customerName}!` : '';
    
    return {
      content: `${greeting}! Bienvenid@ a Rolo Climatización. ❄️🔥

Soy *Rolito*, tu asistente virtual.

¿En qué te podemos ayudar hoy?

1️⃣ Mantenimiento / Service
2️⃣ Reparación o Falla técnica
3️⃣ Instalación de equipos
4️⃣ Cotizaciones / Presupuestos
5️⃣ Venta de Repuestos
6️⃣ Otra consulta
7️⃣ Proveedores / Administración

(Respondé con el número de opción)`,
      options: [
        '1️⃣ Mantenimiento / Service',
        '2️⃣ Reparación o Falla técnica',
        '3️⃣ Instalación de equipos',
        '4️⃣ Cotizaciones / Presupuestos',
        '5️⃣ Venta de Repuestos',
        '6️⃣ Otra consulta',
        '7️⃣ Proveedores / Administración',
      ],
    };
  },

  need_type_asked: () => ({
    content: '¿Qué tipo de servicio necesitas?\n\n1️⃣ Mantenimiento\n2️⃣ Reparación\n3️⃣ Repuestos\n4️⃣ Instalación\n5️⃣ Cotización\n6️⃣ Otro\n\n¿Eres proveedor? Por favor comunícate directamente al 2994584104.',
    options: ['Mantenimiento', 'Reparación', 'Repuestos', 'Instalación', 'Cotización', 'Otro'],
  }),

  detail_asked: (ctx) => {
    // Custom messages for spare_parts and other - skip urgency/location flow
    if (ctx.needType === 'spare_parts') {
      return {
        content: 'Describí brevemente qué tipo de repuesto estás buscando.',
      };
    }
    if (ctx.needType === 'other') {
      return {
        content: 'Describí brevemente cuál es tu consulta.',
      };
    }
    // Default message for other service types (maintenance, repair, installation, quote)
    const needLabel = getNeedLabel(ctx.needType);
    return {
      content: `Perfecto, ${needLabel}. ¿Podrías darme más detalles sobre tu caso? Por ejemplo, qué equipo es, qué problema tenés, etc.`,
    };
  },

  urgency_asked: () => ({
    content: '¿Qué tan urgente es tu necesidad?\n\n🔴 Urgente (hoy)\n🟡 Esta semana\n🟢 No es urgente',
    options: ['Urgente', 'Esta semana', 'No es urgente'],
  }),

  // Nuevos estados del flow de 7 ramas
  urgency: () => ({
    content: '⚡ URGENCIA\n\n¿Con qué urgencia lo necesitás?\n\n1️⃣ Urgente (hoy)\n2️⃣ Esta semana\n3️⃣ Sin apuro',
    options: ['1️⃣ Urgente', '2️⃣ Esta semana', '3️⃣ Sin apuro'],
  }),

  detail: () => ({
    content: '📝 Describí brevemente el problema o servicio que necesitás:',
  }),

  address_confirm: () => ({
    content: '📍 ¿En qué dirección o zona se encuentra el equipo?',
  }),

  priority: () => ({
    content: '⚡ ¿Cuál es la prioridad del servicio?\n\n1️⃣ Normal\n2️⃣ Alta\n3️⃣ Urgente',
  }),

  description: () => ({
    content: '📝 ¿Tenés algo más para agregar sobre el servicio o problema?',
  }),

  name: () => ({
    content: '👤 ¿A nombre de quién registramos la visita?',
  }),

  summary: () => ({
    content: '🙌 ¡Perfecto! Tu solicitud fue registrada.\n\nUn asesor te contactará a la brevedad.\n\n¡Gracias por comunicarte con Rolo Climatización! 👨‍🔧',
  }),

  quote_work: () => ({
    content: '📋 ¿Qué tipo de trabajo o servicio necesitás presupuestar?',
  }),

  spare_part: () => ({
    content: '🔧 ¿Qué repuesto o pieza estás buscando?',
  }),

  general_query: () => ({
    content: '💬 Contame más detalles sobre tu consulta:',
  }),

  suppliers_info: () => ({
    content: '📞 Para consultas de proveedores y administración, comunicate directamente al:\n\n📱 2994584104\n📧 admin@roloclimatizacion.com\n\n¡Gracias por comunicarte! 👋',
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
