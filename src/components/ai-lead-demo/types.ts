/**
 * AI Lead Demo - Configuration and Types
 * 
 * Demo visualization for CRM AI Agent capabilities
 */

export interface LeadData {
  client: string
  service: string
  equipment: string
  priority: 'Alta' | 'Media' | 'Baja'
  intent: string
  location: string
  temperature: 'HOT' | 'WARM' | 'COLD'
  score: number
  status: string
}

export interface DemoConfig {
  message: {
    text: string
    sender: string
    timestamp: string
  }
  lead: LeadData
  timing: {
    messageDelay: number
    aiDetectionDelay: number
    analysisDelay: number
    extractionDelay: number
    scoringDelay: number
    connectionDelay: number
    crmUpdateDelay: number
    finalDelay: number
  }
}

export const DEFAULT_CONFIG: DemoConfig = {
  message: {
    text: "Hola, necesito reparar el aire acondicionado de mi casa. No está enfriando y necesito solucionarlo lo antes posible.",
    sender: "Juan Pérez",
    timestamp: "Ahora"
  },
  lead: {
    client: "Juan Pérez",
    service: "Reparación",
    equipment: "Aire acondicionado",
    priority: "Alta",
    intent: "Solicitar servicio",
    location: "Ciudad de Buenos Aires",
    temperature: "HOT",
    score: 92,
    status: "Contactado"
  },
  timing: {
    messageDelay: 0,
    aiDetectionDelay: 2500,
    analysisDelay: 4000,
    extractionDelay: 6000,
    scoringDelay: 8000,
    connectionDelay: 10500,
    crmUpdateDelay: 12500,
    finalDelay: 15000
  }
}
