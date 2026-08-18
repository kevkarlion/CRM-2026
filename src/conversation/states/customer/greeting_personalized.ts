/**
 * Personalized Greeting State
 * 
 * First state in customer flow - personalized greeting using customer name from context.
 * Routes to different branches based on selected option:
 * - 1-3: Service flow (urgency → detail → address → name)
 * - 4: Quote flow (work → name)
 * - 5: Parts flow (part → name)
 * - 6: General flow (query → name)
 * - 7: Suppliers (shows contact info, ends)
 */

import type { ConversationContext } from '../../context'
import type { ProcessResult, StateIntent } from '../../types'
import type { IConversationState } from '../interface'

// Option mapping with flow branch
const OPTION_BRANCH: Record<string, { serviceType: string; serviceTypeLabel: string; nextState: string; scoring: string }> = {
  '1': { serviceType: 'maintenance', serviceTypeLabel: 'Mantenimiento / Service', nextState: 'urgency', scoring: 'high' },
  '2': { serviceType: 'repair', serviceTypeLabel: 'Reparación o Falla técnica', nextState: 'urgency', scoring: 'high' },
  '3': { serviceType: 'installation', serviceTypeLabel: 'Instalación de equipos', nextState: 'urgency', scoring: 'high' },
  '4': { serviceType: 'budget', serviceTypeLabel: 'Cotizaciones / Presupuestos', nextState: 'quote_work', scoring: 'medium' },
  '5': { serviceType: 'spare_parts', serviceTypeLabel: 'Venta de Repuestos', nextState: 'spare_part', scoring: 'medium' },
  '6': { serviceType: 'other', serviceTypeLabel: 'Otra consulta', nextState: 'general_query', scoring: 'medium' },
  '7': { serviceType: 'suppliers', serviceTypeLabel: 'Proveedores / Administración', nextState: 'suppliers_info', scoring: 'none' },
}

export class GreetingPersonalizedState implements IConversationState {
  readonly id = 'greeting_personalized'

  process(input: string, context: ConversationContext): ProcessResult {
    const trimmed = input.trim()
    const optionNum = trimmed.replace(/[^0-9]/g, '')

    console.log('[GreetingPersonalized] process called with input:', input, '| optionNum:', optionNum);

    // Check if customer already has data (e.g., after "corregir" in summary)
    const existingServiceType = context.get<string>('serviceType')
    const customerName = context.get<string>('customerName')
    
    console.log('[GreetingPersonalized] existingServiceType:', existingServiceType, '| customerName:', customerName);
    
    // If customer already has service type and name, they're returning from correction
    // Skip to summary to review their corrected info
    if (existingServiceType && customerName && !optionNum) {
      console.log('[GreetingPersonalized] Customer returning with existing data - skipping to summary');
      const intent: StateIntent = {
        nextState: 'summary',
      }
      return {
        intent,
        isValid: true,
      }
    }

    // If user selected an option (1-7), route to appropriate branch
    console.log('[GreetingPersonalized] Checking option:', optionNum, '| valid?', optionNum >= '1' && optionNum <= '7');
    if (optionNum && optionNum >= '1' && optionNum <= '7') {
      const branch = OPTION_BRANCH[optionNum]
      console.log('[GreetingPersonalized] Selected branch:', branch);
      
      if (branch) {
        // Special case: Option 7 (Suppliers) - ends immediately with contact info
        if (branch.nextState === 'suppliers_info') {
          console.log('[GreetingPersonalized] → Suppliers - ending conversation');
          const intent: StateIntent = {
            nextState: 'summary', // Will show suppliers info and close
            data: {
              serviceType: branch.serviceType,
              serviceTypeLabel: branch.serviceTypeLabel,
              isSuppliers: true,
            },
          }
          return {
            intent,
            isValid: true,
          }
        }

        console.log('[GreetingPersonalized] → Going to:', branch.nextState);
        const intent: StateIntent = {
          data: {
            serviceType: branch.serviceType,
            serviceTypeLabel: branch.serviceTypeLabel,
            scoringPriority: branch.scoring,
          },
          nextState: branch.nextState,
        }

        return {
          intent,
          isValid: true,
        }
      }
    }

    // Otherwise, stay in greeting and ask for valid option
    console.log('[GreetingPersonalized] Invalid input - showing validation error');
    const intent: StateIntent = {
      validationError: '⚠️ Por favor, elegí una opción del 1 al 7.',
    }

    return {
      intent,
      isValid: false,
    }
  }

  getMessage(context: ConversationContext): string {
    // Get hour in Argentina timezone (UTC-3) - approximate by subtracting 3 from UTC
    const utcHour = new Date().getHours()
    const argentinaHour = (utcHour - 3 + 24) % 24  // Convert UTC to Argentina time
    
    let greeting: string

    // 20:00 - 05:59: Buenas noches
    // 06:00 - 11:59: Buenos días
    // 12:00 - 19:59: Buenas tardes
    if (argentinaHour >= 20 || argentinaHour < 6) {
      greeting = '🌙 Buenas noches'
    } else if (argentinaHour < 12) {
      greeting = '🌞 Buenos días'
    } else {
      greeting = '☀️ Buenas tardes'
    }

    const customerName = context.get<string>('customerName')
    
    return `${greeting}! Bienvenid@ a Rolo Climatización. ❄️🔥

Soy *Rolito*, tu asistente virtual.

¿En qué te podemos ayudarte hoy?

1️⃣ Mantenimiento / Service
2️⃣ Reparación o Falla técnica
3️⃣ Instalación de equipos
4️⃣ Cotizaciones / Presupuestos
5️⃣ Venta de Repuestos
6️⃣ Otra consulta
7️⃣ Proveedores / Administración

(Respondé con el número de opción)`
  }

  getOptions(context: ConversationContext): string[] | undefined {
    return [
      '1️⃣ Mantenimiento / Service',
      '2️⃣ Reparación o Falla técnica',
      '3️⃣ Instalación de equipos',
      '4️⃣ Cotizaciones / Presupuestos',
      '5️⃣ Venta de Repuestos',
      '6️⃣ Otra consulta',
      '7️⃣ Proveedores / Administración',
    ]
  }
}

export default GreetingPersonalizedState