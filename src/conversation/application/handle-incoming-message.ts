import type { ConversationState, ConversationContext } from '../domain/conversation';
import { ConversationStateMachine } from '../domain/state-machine';
import { IntentExtractor } from '../domain/intent-extractor';
import { ConversationLeadScoringService } from '../domain/lead-scoring';
import { HandoffPolicy } from '../domain/handoff-policy';
import { BotReplyComposer } from '../domain/reply-composer';
import { ConversationService } from './conversation.service';
import type { Conversation, BotAction, UpdateConversationInput } from './types';

/**
 * Mapa de opciones válidas por estado.
 * GUARD CLAUSE: Si el usuario envía una opción que no está en esta lista,
 * se devuelve error y se permanece en el mismo estado.
 * 
 * NOTA: address_confirm NO está aquí - el estado maneja sus propias opciones (1=sí, 2=no)
 */
const STATE_VALID_OPTIONS: Record<string, string[]> = {
  greeting_personalized: ['1', '2', '3', '4', '5', '6', '7'],
  urgency: ['1', '2', '3'],
  priority: ['1', '2', '3'],
  quote_work: ['1', '2'],
  spare_part: ['1', '2'],
  general_query: ['1', '2'],
  suppliers_info: ['1', '2'],
};

export interface HandleIncomingMessageInput {
  tenantId: string;
  leadId?: string;
  clientId?: string;
  phone: string;
  messageContent: string;
  profileName?: string;
}

// Dependencias inyectadas (todas son domain services puros + conversation service)
export interface HandleIncomingMessageDeps {
  stateMachine: ConversationStateMachine;
  intentExtractor: IntentExtractor;
  scoringService: ConversationLeadScoringService;
  handoffPolicy: HandoffPolicy;
  replyComposer: BotReplyComposer;
  conversationService: ConversationService;
}

export class HandleIncomingMessageUseCase {
  constructor(private readonly deps: HandleIncomingMessageDeps) {}

  /**
   * Punto de entrada principal. Orquesta todo el flujo:
   * 1. Busca/crea conversación
   * 2. Extrae intent del mensaje
   * 3. Actualiza contexto
   * 4. Avanza state machine
   * 5. Calcula score
   * 6. Evalúa handoff
   * 7. Compone respuesta
   * 8. Guarda conversación
   * 9. Retorna acciones
   */
  async execute(input: HandleIncomingMessageInput): Promise<BotAction[]> {
    const {
      stateMachine,
      intentExtractor,
      scoringService,
      handoffPolicy,
      replyComposer,
      conversationService,
    } = this.deps;

    const actions: BotAction[] = [];

    // 1. Buscar o crear conversación
    const { conversation: foundConversation, isNew } = await conversationService.findOrCreate({
      tenantId: input.tenantId,
      leadId: input.leadId,
      clientId: input.clientId,
      phone: input.phone,
    });
    let conversation = foundConversation;

    // Si es nueva conversación o se reinició, enviar menú de bienvenida inmediatamente
    if (isNew && conversation.state === 'greeting_personalized') {
      console.log('[HandleIncoming] New conversation - sending greeting menu');
      const reply = replyComposer.compose('greeting_personalized', {
        userName: input.profileName,
        profileName: input.profileName,
      });
      actions.push({ type: 'send_message', content: reply.content });
      return actions;
    }

    console.log('[HandleIncoming] Conversation state after findOrCreate:', conversation.state, '| context:', JSON.stringify(conversation.context));

    // Si la conversación ya está cerrada o en handoff, responder con mensaje de cierre o reiniciar si pasaron 48hs
    if (conversation.state === 'closed') {
      // Verificar si pasaron 48hs desde que se cerró
      const closedAt = conversation.closedAt ? new Date(conversation.closedAt).getTime() : 0;
      const fortyEightHoursAgo = Date.now() - (48 * 60 * 60 * 1000);
      
      // Si pasaron más de 48hs, reiniciar el flujo
      if (closedAt < fortyEightHoursAgo) {
        console.log('[HandleIncoming] 48h passed since closure, restarting flow');
        
        // Reiniciar conversación a greeting_personalized
        await conversationService.update(conversation._id, {
          state: 'greeting_personalized',
          previousState: 'closed',
          context: {
            hasEmergencyKeywords: false,
            hasProjectKeywords: false,
            messageContainsData: false,
            userAskedForHuman: false,
          },
          step: 0,
          fallbackCount: 0,
          exchangesInSameState: 0,
          lastMessageAt: new Date(),
        });
        
        // Recargar la conversación reiniciada y continuar el flujo desde ahí
        conversation = await conversationService.findById(conversation._id);
        console.log('[HandleIncoming] Conversation restarted, new state:', conversation.state);
        
        // Enviar menú de bienvenida porque se reinició el flow
        const reply = replyComposer.compose('greeting_personalized', {
          userName: input.profileName,
          profileName: input.profileName,
        });
        actions.push({ type: 'send_message', content: reply.content });
        return actions;
      } else {
        // Si no pasaron 48hs, enviar mensaje de cierre
        const closureMessage = '🙌 Tu solicitud ya fue registrada. Un asesor te contactará a la brevedad.';
        actions.push({ type: 'send_message', content: closureMessage });
        return actions;
      }
    }

    if (conversation.state === 'human_assigned') {
      return actions;
    }

    // 2. Extraer intent del mensaje
    const intent = intentExtractor.extractAll(input.messageContent);

    console.log('[HandleIncoming] Intent extracted:', JSON.stringify({
      needType: intent.needType,
      urgency: intent.urgency,
      location: intent.location,
      hasAnyData: intent.hasAnyData,
    }));

    // 2.1. Si está en greeting_personalized y dice algo simple ("hola", "buenas", etc)
    // → reenviar el menú de 7 opciones
    if (conversation.state === 'greeting_personalized') {
      const simpleWords = ['hola', 'buenas', 'buenos', 'hello', 'hi', 'hey', 'que tal', 'ola'];
      const isSimpleGreeting = simpleWords.some(w => input.messageContent.toLowerCase().includes(w));
      const isValidOption = /^[1-7]$/.test(input.messageContent.trim());
      
      // Si no es greeting simple ni opción válida 1-7, reenviar menú
      if (!isSimpleGreeting && !isValidOption) {
        console.log('[HandleIncoming] Invalid option in greeting_personalized - resending menu');
        // Prioridad: userName (del flow) > customerName (de DB) > profileName (WhatsApp)
        const customerName = 
          conversation.context?.userName || 
          conversation.context?.customerName || 
          input.profileName;
        const reply = replyComposer.compose('greeting_personalized', {
          userName: customerName,
          profileName: customerName,
        });
        actions.push({ type: 'send_message', content: reply.content });
        
        // Actualizar conversation para contar el intento
        await conversationService.update(conversation._id, {
          lastMessageAt: new Date(),
          exchangesInSameState: conversation.exchangesInSameState + 1,
        });
        
        return actions;
      }
      
      if (isSimpleGreeting) {
        console.log('[HandleIncoming] Simple greeting detected in greeting_personalized - resending menu');
        // Prioridad: userName (del flow) > customerName (de DB) > profileName (WhatsApp)
        const customerName = 
          conversation.context?.userName || 
          conversation.context?.customerName || 
          input.profileName;
        const reply = replyComposer.compose('greeting_personalized', {
          userName: customerName,
          profileName: customerName,
        });
        actions.push({ type: 'send_message', content: reply.content });
        return actions;
      }
    }

    // 3. Actualizar contexto con los datos extraídos
    const updatedContext = this.mergeContext(conversation.context, intent, input.messageContent, input.profileName);

    // 3.1. Si estamos en estado 'name' y el usuario respondió algo, usar ese texto como nombre
    // (sobrescribir el nombre del perfil si el usuario da otro nombre explícitamente)
    if (conversation.state === 'name' && input.messageContent.trim().length > 0) {
      const providedName = input.messageContent.trim();
      updatedContext.userName = providedName;
      console.log('[HandleIncoming] Name captured from user response:', providedName);
    }

    console.log('[HandleIncoming] Before advanceState - conversation.state:', conversation.state, '| newState variable not set yet');

    // 3.1. LeadContactEstablished: el lead provee datos reales por primera vez
    const hadDataBefore = conversation.context.needType
      || conversation.context.urgency
      || conversation.context.location
      || conversation.context.equipmentType;
    if (intent.hasAnyData && !hadDataBefore) {
      actions.push({
        type: 'emit_domain_event',
        event: {
          type: 'LeadContactEstablished',
          leadId: input.leadId,
          tenantId: input.tenantId,
          timestamp: new Date(),
          trigger: 'message_with_data',
        },
      });
    }

    // 4. Definir si es nuevo flow state
    const isNewFlowState = 
      conversation.state === 'greeting_personalized' || 
      conversation.state === 'urgency' ||
      conversation.state === 'spare_part' ||
      conversation.state === 'quote_work' ||
      conversation.state === 'general_query';
    
    // Excepción: greeting_personalized, urgency, spare_part, quote_work, general_query tienen su propia lógica
    const isNameStateWithInput = conversation.state === 'name' && 
                                  input.messageContent.trim().length > 0 && 
                                  updatedContext.userName;
    
    // Customer flow states that handle their own invalid input (no fallback)
    const isCustomerFlowQuestionState = 
      conversation.state === 'greeting_personalized' || 
      conversation.state === 'urgency' ||
      conversation.state === 'spare_part' ||
      conversation.state === 'quote_work' ||
      conversation.state === 'general_query' ||
      conversation.state === 'service_type' ||
      conversation.state === 'address_confirm' ||
      conversation.state === 'priority' ||
      conversation.state === 'detail' ||
      conversation.state === 'description' ||
      conversation.state === 'name' ||
      conversation.state === 'suppliers_info';
    
    // Lead flow states that handle their own invalid input (no fallback)
    const isLeadFlowQuestionState = 
      conversation.state === 'greeting_personalized' ||
      conversation.state === 'name' ||
      conversation.state === 'service' ||
      conversation.state === 'address' ||
      conversation.state === 'priority' ||
      conversation.state === 'description' ||
      // Estados que pueden venir del flow de cliente (por migración o detección errónea)
      conversation.state === 'detail' ||
      conversation.state === 'urgency' ||
      conversation.state === 'address_confirm' ||
      conversation.state === 'quote_work' ||
      conversation.state === 'spare_part' ||
      conversation.state === 'general_query' ||
      conversation.state === 'suppliers_info';
    
    // NUNCA usamos fallback - los estados manejan sus propios errores
    const isNewFlowQuestionState = true;
    
    // FALLBACK ELIMINADO - No hay fallback bajo ninguna circunstancia
    // Si el usuario escribe algo inválido, el estado se reenvía el prompt
    
    if (false && !isNewFlowQuestionState && !intent.hasAnyData && !intent.userAskedForHuman && this.isQuestionState(conversation.state) && !isNameStateWithInput) {
      const newFallbackCount = conversation.fallbackCount + 1;
      const fallbackResult = stateMachine.handleFallback(conversation.state, newFallbackCount);

      if (fallbackResult.shouldHandoff) {
        const handoffResult = handoffPolicy.shouldHandoff({
          score: 0,
          temperature: 'cold',
          context: updatedContext,
          fallbackCount: newFallbackCount,
          timeoutCount: conversation.timeoutCount,
          exchangesInSameState: conversation.exchangesInSameState + 1,
          currentState: conversation.state,
        });

        const reply = replyComposer.composeForHandoff(handoffResult.reason);

        await conversationService.update(conversation._id, {
          state: 'handoff_pending',
          previousState: conversation.state,
          context: updatedContext,
          fallbackCount: newFallbackCount,
          exchangesInSameState: 0,
          handoffStatus: 'pending',
          handoffReason: handoffResult.reason,
          lastMessageAt: new Date(),
        });

        actions.push({ type: 'send_message', content: reply.content });
        actions.push({
          type: 'trigger_handoff',
          conversationId: conversation._id,
          reason: handoffResult.reason,
          priority: handoffResult.priority,
        });

        return actions;
      }

      // Es fallback pero no handoff aún
      const reply = replyComposer.composeFallback();

      await conversationService.update(conversation._id, {
        state: 'fallback',
        previousState: conversation.state,
        context: updatedContext,
        fallbackCount: newFallbackCount,
        exchangesInSameState: conversation.exchangesInSameState + 1,
        lastMessageAt: new Date(),
      });

      actions.push({ type: 'send_message', content: reply.content });
      return actions;
    }

    // 6. Avanzar state machine (skip steps si data ya disponible)
    // Para el nuevo flow, NO usar userAskedForHuman - el flow es puro sin handoff
    const contextForStateMachine = isNewFlowState 
      ? { ...updatedContext, userAskedForHuman: false }
      : updatedContext;
    
    // ===== GUARD CLAUSE: Validar opción contra opciones válidas del estado actual =====
    const currentState = conversation.state;
    const userOption = input.messageContent.trim();
    const validOptions = STATE_VALID_OPTIONS[currentState];
    
    // Si el estado actual tiene opciones válidas definidas Y el input es un número
    if (validOptions && /^\d+$/.test(userOption)) {
      if (!validOptions.includes(userOption)) {
        // EARLY EXIT: Opción inválida para este estado
        console.log('[HandleIncoming] Invalid option for state', currentState, '- option:', userOption, '- valid:', validOptions);
        
        // Reenviar la pregunta del estado actual con mensaje de error
        const errorReply = replyComposer.compose(currentState, updatedContext);
        const errorMessage = `⚠️ Opción inválida. Por favor elegí una de las opciones válidas: ${validOptions.join(', ')}\n\n${errorReply.content}`;
        
        // Actualizar contador de intentos
        await conversationService.update(conversation._id, {
          exchangesInSameState: conversation.exchangesInSameState + 1,
          lastMessageAt: new Date(),
        });
        
        actions.push({ type: 'send_message', content: errorMessage });
        return actions;
      }
    }
    // ===== FIN GUARD CLAUSE =====

    // ===== SPECIAL HANDLING: address_confirm con "2" = pedir nueva dirección =====
    if (currentState === 'address_confirm' && userOption === '2') {
      console.log('[HandleIncoming] User chose option 2 in address_confirm - asking for new address');
      
      // Pedir nueva dirección (quedarse en el mismo estado)
      const reply = replyComposer.compose('address_confirm', {
        ...updatedContext,
        askingNewAddress: true,
      });
      
      // Actualizar contexto para indicar que estamos pidiendo nueva dirección
      updatedContext.askingNewAddress = true;
      
      await conversationService.update(conversation._id, {
        context: updatedContext,
        exchangesInSameState: conversation.exchangesInSameState + 1,
        lastMessageAt: new Date(),
      });
      
      actions.push({ type: 'send_message', content: reply.content });
      return actions;
    }
    // ===== FIN SPECIAL HANDLING =====

    // FIX: Si es cliente (customer) y está en idle, forzar a greeting_personalized
    // El state machine elegiría 'greeting' (legacy) pero necesitamos el nuevo flow de cliente
    let transition;
    if (conversation.conversationType === 'customer' && conversation.state === 'idle') {
      console.log('[HandleIncoming] Customer in idle - forcing greeting_personalized');
      transition = { nextState: 'greeting_personalized', isValid: true, skippedStates: [] };
    } else {
      transition = stateMachine.advanceState(conversation.state, contextForStateMachine, input.messageContent);
    }

    if (!transition.isValid) {
      // Estado terminal o transición inválida
      // Si hay contexto con datos, mostrar mensaje de confirmación
      if (updatedContext.needType || updatedContext.location) {
        const reply = replyComposer.composeForConfirmation(updatedContext);
        if (reply.content) {
          actions.push({ type: 'send_message', content: reply.content });
        }
      }
      return actions;
    }

    const newState = transition.nextState;

    console.log('[HandleIncoming] transition.nextState:', transition.nextState, '| isValid:', transition.isValid, '| conversation.state:', conversation.state);
    console.log('[HandleIncoming] newState after advanceState:', newState);

    // 6.1. Si sigue en estados de pregunta del nuevo flow (el usuario no eligió opción válida), reenviar mensaje
    const isGreetingWithInvalidOption = conversation.state === 'greeting_personalized' && newState === 'greeting_personalized';
    const isUrgencyWithInvalidOption = conversation.state === 'urgency' && newState === 'urgency';
    const isSparePartWithInput = conversation.state === 'spare_part' && input.messageContent.trim().length > 0;
    const isQuoteWorkWithInput = conversation.state === 'quote_work' && input.messageContent.trim().length > 0;
    const isGeneralQueryWithInput = conversation.state === 'general_query' && input.messageContent.trim().length > 0;
    
    // Para spare_part, quote_work, general_query - si el usuario dice algo, avanzar a name/summary
    if (isSparePartWithInput || isQuoteWorkWithInput || isGeneralQueryWithInput) {
      console.log('[HandleIncoming] User provided input in question state, advancing to next step');
      // El state machine ya avanza automáticamente, solo dejamos que continúe
    } else if (isGreetingWithInvalidOption || isUrgencyWithInvalidOption) {
      const userInput = input.messageContent.trim();
      const state = conversation.state;
      
      // Determinar el mensaje según el estado
      let message: string;
      
      if (state === 'greeting_personalized') {
        // Verificar si el usuario envió un número que no es 1-7
        const isNumber = /^\d+$/.test(userInput);
        if (isNumber) {
          message = '⚠️ Por favor, elegí una opción del 1 al 7:\n\n1️⃣ Mantenimiento\n2️⃣ Reparación\n3️⃣ Instalación\n4️⃣ Cotización\n5️⃣ Repuestos\n6️⃣ Otra consulta\n7️⃣ Proveedores';
        } else {
          const reply = replyComposer.compose('greeting_personalized', {
            userName: input.profileName,
            profileName: input.profileName,
          });
          message = reply.content;
        }
      } else if (state === 'urgency') {
        // Verificar si el usuario envió un número que no es 1-3
        const isNumber = /^\d+$/.test(userInput);
        if (isNumber) {
          message = '⚠️ Por favor, elegí una opción del 1 al 3:\n\n1️⃣ Urgente (hoy)\n2️⃣ Esta semana\n3️⃣ Sin apuro';
        } else {
          const reply = replyComposer.compose('urgency', {});
          message = reply.content;
        }
      }
      
      actions.push({ type: 'send_message', content: message });
      return actions;
    }

    // 7. Actualizar contexto y avanzar conversación
    const newFallbackCount = intent.hasAnyData ? 0 : conversation.fallbackCount;
    const exchangesInSameState = newState === conversation.state
      ? conversation.exchangesInSameState + 1
      : 0;

    await conversationService.update(conversation._id, {
      state: newState,
      previousState: conversation.state,
      context: updatedContext,
      fallbackCount: newFallbackCount,
      exchangesInSameState,
      lastMessageAt: new Date(),
      step: conversation.step + 1,
    });

    // 7.1. Si el flujo de 7 ramas se completó (summary o waiting_operator), emitir LeadFlowCompleted
    // EXCEPTO para suppliers_info (opción 7) - no es un lead, solo información de contacto
    const isSuppliersFlow = conversation.state === 'suppliers_info';
    const isClientFlow = conversation.conversationType === 'customer';
    
    if (newState === 'summary' || newState === 'waiting_operator') {
      console.log('[HandleIncoming] Flow completed, closing conversation', isSuppliersFlow ? '(suppliers - no lead)' : '', isClientFlow ? '(client - no lead)' : '');
      
      // Solo emitir LeadFlowCompleted si hay leadId Y no es flow de cliente
      if (!isSuppliersFlow && !isClientFlow && input.leadId) {
        actions.push({
          type: 'emit_domain_event',
          event: {
            type: 'LeadFlowCompleted',
            leadId: input.leadId,
            tenantId: input.tenantId,
            timestamp: new Date(),
            context: updatedContext,
          },
        });
      }

      // Cerrar conversación
      await conversationService.update(conversation._id, {
        state: 'closed',
        closedAt: new Date(),
      });
      
      actions.push({
        type: 'close_conversation',
        conversationId: conversation._id,
      });
    }

    // 8. Si llegamos a evaluate, calcular score
    if (newState === 'evaluate' || newState === 'scored') {
      // Get additional data from engineData if available
      const engineData = conversation.engineData as Record<string, unknown> || {};
      
      // Merge engineData into updatedContext for scoring
      const scoringContext = {
        ...updatedContext,
        needType: updatedContext.needType ?? engineData.needType as string ?? undefined,
        urgency: updatedContext.urgency ?? engineData.urgency as string ?? undefined,
        location: updatedContext.location ?? engineData.location as string ?? undefined,
        customerType: updatedContext.customerType ?? engineData.customerType as string ?? undefined,
        equipmentType: updatedContext.equipmentType ?? engineData.equipmentType as string ?? undefined,
};
       
      const scoringResult = scoringService.calculateScore(scoringContext as ConversationContext);

      // NO handoff para nuevos flow states - solo cerrar conversación
      const isNewFlowState =
        newState === 'summary' || 
        conversation.state === 'greeting_personalized' || 
        conversation.state === 'urgency' ||
        conversation.state === 'spare_part' ||
        conversation.state === 'quote_work' ||
        conversation.state === 'general_query';

      const handoffResult = handoffPolicy.shouldHandoff({
        score: scoringResult.score,
        temperature: scoringResult.temperature,
        context: updatedContext,
        fallbackCount: newFallbackCount,
        timeoutCount: conversation.timeoutCount,
        exchangesInSameState,
        currentState: newState,
      });

      // Actualizar lead con score y datos de contacto (incluyendo dirección)
      actions.push({
        type: 'update_lead',
        leadId: input.leadId,
        updates: {
          score: scoringResult.score,
          temperature: scoringResult.temperature,
          inquiryReason: updatedContext.needType ?? undefined,
          customerType: updatedContext.customerType ?? undefined,
          status: 'contacted',
          address: (updatedContext as any).address ?? (updatedContext as any).customerAddress ?? (updatedContext as any).location ?? undefined,
          locality: (updatedContext as any).locality ?? (updatedContext as any).customerLocality ?? undefined,
          province: (updatedContext as any).province ?? (updatedContext as any).customerProvince ?? undefined,
          scoringBreakdown: {
            buttons: scoringResult.breakdown.urgency + scoringResult.breakdown.needClarity,
            property: scoringResult.breakdown.customerType,
            keywords: scoringResult.breakdown.emergencyBonus + scoringResult.breakdown.projectBonus,
            b2b: scoringResult.breakdown.humanRequestBonus,
          },
        },
      });

      // Also update Gestion if exists (for clients whose lead was won)
      actions.push({
        type: 'update_gestion_for_client',
        leadId: input.leadId,
        updates: {
          status: 'contacted',
          score: scoringResult.score,
          temperature: scoringResult.temperature,
          inquiryReason: updatedContext.needType ?? undefined,
        },
      });

      // Update client with new address if provided and different from existing
      const newAddress = (updatedContext as any).address;
      const existingCustomerAddress = (updatedContext as any).customerAddress;
      
      // Get clientId from engineData (the schema uses engineData, not direct clientId field)
      const convEngineData = conversation.engineData as Record<string, unknown> || {};
      const clientIdFromConversation = convEngineData.clientId as string | undefined;

      // Only update if: has clientId AND has new address different from existing
      if (clientIdFromConversation && newAddress && newAddress !== existingCustomerAddress) {
        console.log('[HandleIncoming] Updating client address:', {
          clientId: clientIdFromConversation,
          address: newAddress,
        });
        actions.push({
          type: 'update_client',
          clientId: clientIdFromConversation,
          updates: {
            address: newAddress,
          },
        });
      }

      // Para nuevo flow, NO hacer handoff - solo cerrar
      if (handoffResult.shouldHandoff && !isNewFlowState) {
        const reply = replyComposer.composeForHandoff(handoffResult.reason);

        await conversationService.update(conversation._id, {
          state: 'handoff_pending',
          handoffStatus: 'pending',
          handoffReason: handoffResult.reason,
        });

        actions.push({ type: 'send_message', content: reply.content });
        actions.push({
          type: 'trigger_handoff',
          conversationId: conversation._id,
          reason: handoffResult.reason,
          priority: handoffResult.priority,
        });

        return actions;
      }

      // Lead no es hot → cerrar conversación
      await conversationService.update(conversation._id, {
        state: 'closed',
        closedAt: new Date(),
      });

      actions.push({
        type: 'close_conversation',
        conversationId: conversation._id,
      });

      return actions;
    }

    // 9. Compone y retorna la respuesta para el estado actual
    // IMPORTANTE: usar newState, NO updatedConversation.state porque ya fue cerrado
    const finalContext = updatedContext;
    const finalState = newState;

    console.log('[HandleIncoming] Composing reply for state:', finalState, '| newState was:', newState, '| context:', JSON.stringify(finalContext));

    // SOLO para CLIENTES: Si el contexto ya tiene los datos, confirmar en lugar de pedir
    // Para LEADS: siempre preguntar (son carga inicial)
    const isCustomer = conversation.conversationType === 'customer';
    const isLead = conversation.conversationType === 'lead';

    // Para address_confirm: solo para clientes, confirmar dirección existente
    if (isCustomer && finalState === 'address_confirm') {
      const existingAddress = (finalContext as any).location || (finalContext as any).customerAddress || (finalContext as any).address;
      if (existingAddress) {
        // Cliente tiene dirección - confirmar en lugar de pedir
        const reply = replyComposer.composeForConfirmation(finalContext);
        if (reply.content) {
          actions.push({ type: 'send_message', content: reply.content });
        }
        return actions;
      }
    }

    // Para name: solo para clientes con nombre existente, hacer skip
    if (isCustomer && finalState === 'name') {
      const existingName = (finalContext as any).userName || (finalContext as any).customerName;
      if (existingName) {
        console.log('[HandleIncoming] Customer name already exists:', existingName, '- skipping to next state');
        // Cliente tiene nombre - hacer skip y cerrar
        actions.push({ type: 'close_conversation', conversationId: conversation._id });
        const summaryReply = replyComposer.compose('summary', finalContext);
        actions.push({ type: 'send_message', content: summaryReply.content });
        return actions;
      }
    }

    // Para leads: siempre preguntar (no hacer skip aunque tenga profileName)
    // El lead es carga inicial - necesita nombre y dirección reales

    const reply = replyComposer.compose(finalState, finalContext);
    actions.push({ type: 'send_message', content: reply.content });

    return actions;
  }

  /**
   * Merge del contexto existente con los datos nuevos extraídos del mensaje.
   * Solo sobrescribe campos que tienen valor (no null/undefined).
   */
  private mergeContext(
    existing: ConversationContext,
    intent: ReturnType<IntentExtractor['extractAll']>,
    messageContent: string,
    profileName?: string
  ): ConversationContext {
    // The context.data contains all flow data (needType, urgency, etc.)
    // that was collected during the conversation
    const contextData = (existing as any).data || {};
    
    return {
      ...existing,
      userName: existing.userName || profileName,
      profileName: existing.profileName || profileName,
      // Priority to intent data, then context data, then existing
      needType: intent.needType ?? contextData.needType ?? existing.needType,
      urgency: intent.urgency ?? contextData.urgency ?? existing.urgency,
      location: intent.location ?? contextData.location ?? existing.location,
      customerType: intent.customerType ?? contextData.customerType ?? existing.customerType,
      equipmentType: intent.equipmentType ?? contextData.equipmentType ?? existing.equipmentType,
      hasEmergencyKeywords: existing.hasEmergencyKeywords || intent.hasEmergencyKeywords,
      hasProjectKeywords: existing.hasProjectKeywords || intent.hasProjectKeywords,
      messageContainsData: intent.hasAnyData,
      userAskedForHuman: intent.userAskedForHuman,
      // Map needType to serviceType for the 7-branch flow
      serviceType: intent.needType ?? contextData.serviceType ?? existing.serviceType,
    };
  }

  /**
   * Verifica si el estado actual es un estado de pregunta
   */
  private isQuestionState(state: ConversationState): boolean {
    const QUESTION_STATES: ConversationState[] = [
      'greeting_personalized',
      'need_type_asked',
      'detail_asked',
      'customer_type_asked',
      'urgency_asked',
      'location_asked',
      'equipment_asked',
      'urgency',
      'detail',
      'description',
      'name',
      'address_confirm',
      'priority',
      'quote_work',
      'spare_part',
      'general_query',
      'suppliers_info',
    ];
    return QUESTION_STATES.includes(state);
  }
}
