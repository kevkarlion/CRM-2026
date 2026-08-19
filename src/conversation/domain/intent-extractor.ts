import type { InquiryReason, CustomerType, UrgencyLevel } from './conversation';

export interface ExtractedIntent {
  needType: InquiryReason | null;
  urgency: UrgencyLevel | null;
  location: string | null;
  customerType: CustomerType | null;
  equipmentType: string | null;
  hasEmergencyKeywords: boolean;
  hasProjectKeywords: boolean;
  userAskedForHuman: boolean;
  hasAnyData: boolean;
  shouldRestart: boolean; // Para reiniciar conversación cuando dice "hola"
}

// Keywords para tipos de necesidad (RepairReason / InquiryReason)
const NEED_TYPE_KEYWORDS: Record<InquiryReason, string[]> = {
  repair: [
    'reparar', 'reparación', 'reparacion', 'roto', 'rompido', 'no funciona',
    'falla', 'avería', 'averia', 'dañado', 'danado', 'descompuesto',
    'arreglar', 'arreglo', 'solucionar', 'problema', 'defecto',
  ],
  installation: [
    'instalar', 'instalación', 'instalacion', 'nuevo', 'nueva',
    'poner', 'colocar', 'equipo nuevo', 'aire nuevo',
  ],
  maintenance: [
    'mantenimiento', 'service', 'servicio', 'limpieza', 'revisión',
    'revision', 'chequeo', 'control', 'cambio de gas', 'carga de gas',
  ],
  spare_parts: [
    'repuesto', 'repuestos', 'repuestos', 'recambio', 'recambios',
    'venta de repuesto', 'comprar repuesto', 'necesito repuesto',
    'busco repuesto', 'donde comprar repuesto',
  ],
  budget: [
    'presupuesto', 'cotización', 'cotizacion', 'cotizar', 'cuánto cuesta',
    'cuanto cuesta', 'precio', 'costo', 'presup', 'valuar', 'valor',
  ],
  other: [],
  general: [],
};

// Keywords de urgencia
const URGENCY_KEYWORDS: Record<UrgencyLevel, string[]> = {
  high: [
    'hoy', 'urgent', 'urgente', 'asap', 'ya', 'ahora', 'emergencia',
    'emerg', 'inmediato', 'no puedo', 'hace calor', 'hace frío', 'hace frio',
    'sin aire', 'no enfría', 'no enfria', 'no calienta', 'no heat',
  ],
  medium: [
    'esta semana', 'pronto', 'próxim', 'proxim', 'a la brevedad',
    'lo antes posible', 'pronto', 'days', 'días', 'dias',
  ],
  low: [
    'cuando puedan', 'cuando pueda', 'no es urgente', 'sin prisa',
    'no hay prisa', 'después', 'despues', 'luego', 'más adelante',
    'mas adelante', 'cuando quieran',
  ],
};

// Keywords de emergencia (bonificación extra)
const EMERGENCY_KEYWORDS: string[] = [
  'no enfría', 'no enfria', 'no calienta', 'fuga de gas', 'fuga',
  'sin luz', 'sin energía', 'sin energia', 'humo', 'olor a gas',
  'goteo', 'inundación', 'inundacion', 'cortocircuito', 'chispa',
];

// Keywords de proyecto (bonificación extra)
const PROJECT_KEYWORDS: string[] = [
  'casa nueva', 'oficina nueva', 'complejo', 'edificio', 'local comercial',
  'ph', 'duplex', 'triplex', 'condominio', 'consorcio',
  'remodelación', 'remodelacion', 'obra nueva', 'construcción', 'construccion',
];

// Keywords de solicitud de humano
const HUMAN_REQUEST_KEYWORDS: string[] = [
  'hablar con alguien', 'hablar con persona', 'persona humana', 'humano',
  'agente', 'vendedor', 'asesor', 'técnico', 'tecnico', 'representante',
  'operador', 'operadora', 'supervisor', 'gerente',
  'hablar con un', 'hablar con una', 'atención humana', 'atencion humana',
  'quiero hablar', 'necesito hablar', 'me atiende alguien',
];

// Mapa de keywords de equipo a tipos estandarizados
const EQUIPMENT_KEYWORDS: Record<string, string[]> = {
  'aire acondicionado': ['aire acondicionado', 'a/a', 'aa', 'split', 'mini split', 'minisplit', 'central', 'ventilón', 'ventilon'],
  'calefacción': ['calefacción', 'calefaccion', 'calefactor', 'estufa', 'radiador', 'calefont', 'caldera'],
  'refrigeración': ['refrigeración', 'refrigeracion', 'refrigerador', 'heladera', 'freezer', 'frío industrial'],
  'ventilación': ['ventilación', 'ventilacion', 'extractor', 'ventilador'],
  'calefacción por aire': ['bomba de calor', 'heat pump'],
};

// Patrón para detectar direcciones/zonas comunes
const LOCATION_PATTERNS: RegExp[] = [
  // Barrios y zonas comunes en Argentina
  /(?:en|de|zona|barrio|ubicad[oa]?\s+en|dirección|direccion)\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]{3,50})/i,
  // Calles
  /(?:calle|av\.|avenida|av)\s+([A-Za-záéíóúñÁÉÍÓÚÑ\s]{3,50})/i,
  // Números de puerta
  /\b(\d{1,5})\s*(?:piso|departamento|depto|dto|casa|local)\b/i,
];

export class IntentExtractor {
  /**
   * Extrae el tipo de necesidad del mensaje
   */
  extractNeedType(text: string): InquiryReason | null {
    const lower = text.toLowerCase().trim();

    // Si parece ser un nombre (texto libre en estado de nombre), no es needType
    // Solo buscar keywords específicos
    if (lower.length < 20 && !/^\d+$/.test(lower)) {
      // No es un número solo, puede ser nombre u otra respuesta simple
    }

    // Mapeo de opciones numéricas del menú (7 opciones)
    const OPTION_MAP: Record<string, InquiryReason> = {
      '1': 'maintenance',
      '2': 'repair',
      '3': 'installation',
      '4': 'budget',
      '5': 'spare_parts',
      '6': 'other',
      '7': 'other', // suppliers - trata como other para el flow, luego se marca especial
      // Texto de opciones
      'mantenimiento': 'maintenance',
      'service': 'maintenance',
      'reparación': 'repair',
      'reparacion': 'repair',
      'falla': 'repair',
      'repuestos': 'spare_parts',
      'repuesto': 'spare_parts',
      'instalación': 'installation',
      'instalacion': 'installation',
      'cotización': 'budget',
      'cotizacion': 'budget',
      'presupuesto': 'budget',
      'presup': 'budget',
      'cotizaciones': 'budget',
      'presupuestos': 'budget',
      'otro': 'other',
      'otra consulta': 'other',
      'proveedores': 'other',
    };

    // Primero verificar si es una opción numérica o texto directo
    if (OPTION_MAP[lower]) {
      return OPTION_MAP[lower];
    }

    // También verificar si el texto empieza con el número
    for (const [key, value] of Object.entries(OPTION_MAP)) {
      if (lower.startsWith(key)) {
        return value;
      }
    }

    // Buscar keywords
    for (const [type, keywords] of Object.entries(NEED_TYPE_KEYWORDS)) {
      if (type === 'other' || type === 'general') continue;
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return type as InquiryReason;
        }
      }
    }

    return null;
  }

  /**
   * Extrae el nivel de urgencia del mensaje
   */
  extractUrgency(text: string): UrgencyLevel | null {
    const lower = text.toLowerCase().trim();

    // Primero verificar si es un número (1, 2, 3)
    const numMap: Record<string, UrgencyLevel> = {
      '1': 'high',
      '2': 'medium', 
      '3': 'low',
    };
    if (numMap[lower]) {
      return numMap[lower];
    }

    // Luego buscar keywords
    for (const level of ['high', 'medium', 'low'] as UrgencyLevel[]) {
      for (const keyword of URGENCY_KEYWORDS[level]) {
        if (lower.includes(keyword)) {
          return level;
        }
      }
    }

    return null;
  }

  /**
   * Extrae ubicación del mensaje
   */
  extractLocation(text: string): string | null {
    // Si parece una dirección (contiene número de dirección), tomarla directamente
    if (/\d/.test(text) && text.length > 5) {
      // "ushuaia 1617", "San Juan 123", etc.
      return text.trim();
    }

    for (const pattern of LOCATION_PATTERNS) {
      const match = text.match(pattern);
      if (match?.[1]) {
        return match[1].trim();
      }
    }

    // Detectar menciones de barrios/zonas conocidas
    const lower = text.toLowerCase();
    const zoneMatch = lower.match(
      /(?:zona|barrio|sector|área|area)\s+([a-záéíóúñ\s]{3,30})/i
    );
    if (zoneMatch?.[1]) {
      return zoneMatch[1].trim();
    }

    return null;
  }

  /**
   * Extrae tipo de cliente (residencial/comercial)
   */
  extractCustomerType(text: string): CustomerType | null {
    const lower = text.toLowerCase();

    const commercialKeywords = [
      'empresa', 'negocio', 'local', 'comercio', 'oficina', 'industria',
      'fábrica', 'fabrica', 'warehouse', 'depósito', 'deposito',
      'consultorio', 'clínica', 'clinica', 'hotel', 'restaurante',
    ];

    const residentialKeywords = [
      'casa', 'departamento', 'depto', 'ph', 'duplex', 'monoambiente',
      'hogar', 'vivienda', 'domicilio', 'mi casa', 'mi depto',
    ];

    for (const keyword of commercialKeywords) {
      if (lower.includes(keyword)) return 'commercial';
    }

    for (const keyword of residentialKeywords) {
      if (lower.includes(keyword)) return 'residential';
    }

    return null;
  }

  /**
   * Extrae tipo de equipo mencionado
   */
  extractEquipmentType(text: string): string | null {
    const lower = text.toLowerCase();

    for (const [type, keywords] of Object.entries(EQUIPMENT_KEYWORDS)) {
      for (const keyword of keywords) {
        if (lower.includes(keyword)) {
          return type;
        }
      }
    }

    return null;
  }

  /**
   * Detecta si el mensaje contiene keywords de emergencia
   */
  hasEmergencyKeywords(text: string): boolean {
    const lower = text.toLowerCase();
    return EMERGENCY_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Detecta si el mensaje contiene keywords de proyecto
   */
  hasProjectKeywords(text: string): boolean {
    const lower = text.toLowerCase();
    return PROJECT_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Detecta si el usuario está pidiendo hablar con un humano
   */
  isAskingForHuman(text: string): boolean {
    const lower = text.toLowerCase();
    return HUMAN_REQUEST_KEYWORDS.some(kw => lower.includes(kw));
  }

  /**
   * Detecta si el usuario quiere reiniciar la conversación
   */
  isRestartRequest(text: string): boolean {
    const lower = text.toLowerCase().trim();
    const RESTART_KEYWORDS = ['hola', 'hello', 'hi', 'empezar', 'iniciar', 'nuevo', 'start', 'reiniciar', 'otra vez', 'de nuevo'];
    return RESTART_KEYWORDS.includes(lower);
  }

  /**
   * Extrae todo el intent del mensaje en una sola llamada
   */
  extractAll(text: string): ExtractedIntent {
    const needType = this.extractNeedType(text);
    const urgency = this.extractUrgency(text);
    const location = this.extractLocation(text);
    const customerType = this.extractCustomerType(text);
    const equipmentType = this.extractEquipmentType(text);
    const hasEmergency = this.hasEmergencyKeywords(text);
    const hasProject = this.hasProjectKeywords(text);
    const userAskedForHuman = this.isAskingForHuman(text);

    const hasAnyData = needType !== null
      || urgency !== null
      || location !== null
      || customerType !== null
      || equipmentType !== null;

    // Detectar si el usuario quiere reiniciar ("hola", "empezar", "nuevo", etc.)
    const shouldRestart = this.isRestartRequest(text);

    return {
      needType,
      urgency,
      location,
      customerType,
      equipmentType,
      hasEmergencyKeywords: hasEmergency,
      hasProjectKeywords: hasProject,
      userAskedForHuman,
      hasAnyData,
      shouldRestart,
    };
  }
}
