import type {
  ConversationState,
  ConversationContext,
} from '../domain/conversation';
import { ConversationStateMachine } from '../domain/state-machine';
import { IntentExtractor } from '../domain/intent-extractor';
import { ConversationLeadScoringService } from '../domain/lead-scoring';
import { HandoffPolicy } from '../domain/handoff-policy';
import { BotReplyComposer } from '../domain/reply-composer';
import { ConversationService } from './conversation.service';
import type { Conversation, BotAction, UpdateConversationInput } from './types';

export interface HandleIncomingMessageInput {
  tenantId: string;
  leadId: string;
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
    let conversation = await conversationService.findOrCreate({
      tenantId: input.tenantId,
      leadId: input.leadId,
    });

    // Si la conversación ya está cerrada o en handoff, no procesar
    if (conversation.state === 'closed') {
      return [];
    }

    if (conversation.state === 'human_assigned') {
      return [];
    }

    // 2. Extraer intent del mensaje
    const intent = intentExtractor.extractAll(input.messageContent);

    // 3. Actualizar contexto con los datos extraídos
    const updatedContext = this.mergeContext(conversation.context, intent, input.messageContent, input.profileName);

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

    // 4. Manejar estados especiales primero
    if (intent.userAskedForHuman && conversation.state !== 'handoff_pending') {
      const handoffResult = handoffPolicy.shouldHandoff({
        score: 0,
        temperature: 'cold',
        context: updatedContext,
        fallbackCount: conversation.fallbackCount,
        timeoutCount: conversation.timeoutCount,
        exchangesInSameState: conversation.exchangesInSameState,
        currentState: conversation.state,
      });

      const reply = replyComposer.composeForHandoff(handoffResult.reason);

      const updates: UpdateConversationInput = {
        state: 'handoff_pending',
        previousState: conversation.state,
        context: updatedContext,
        handoffStatus: 'pending',
        handoffReason: handoffResult.reason,
        lastMessageAt: new Date(),
        exchangesInSameState: 0,
      };

      conversation = await conversationService.update(conversation._id, updates);

      actions.push({ type: 'send_message', content: reply.content });
      actions.push({
        type: 'trigger_handoff',
        conversationId: conversation._id,
        reason: handoffResult.reason,
        priority: handoffResult.priority,
      });

      return actions;
    }

    // 5. Manejar fallback (respuesta no entendida)
    if (!intent.hasAnyData && !intent.userAskedForHuman && this.isQuestionState(conversation.state)) {
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
    const transition = stateMachine.advanceState(conversation.state, updatedContext);

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

      const handoffResult = handoffPolicy.shouldHandoff({
        score: scoringResult.score,
        temperature: scoringResult.temperature,
        context: updatedContext,
        fallbackCount: newFallbackCount,
        timeoutCount: conversation.timeoutCount,
        exchangesInSameState,
        currentState: newState,
      });

      // Actualizar lead con score
      actions.push({
        type: 'update_lead',
        leadId: input.leadId,
        updates: {
          score: scoringResult.score,
          temperature: scoringResult.temperature,
          inquiryReason: updatedContext.needType ?? undefined,
          customerType: updatedContext.customerType ?? undefined,
          status: 'contacted',
          scoringBreakdown: {
            buttons: scoringResult.breakdown.urgency + scoringResult.breakdown.needClarity,
            property: scoringResult.breakdown.customerType,
            keywords: scoringResult.breakdown.emergencyBonus + scoringResult.breakdown.projectBonus,
            b2b: scoringResult.breakdown.humanRequestBonus,
          },
        },
      });

      if (handoffResult.shouldHandoff) {
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
    // Recargar conversación para tener el estado actualizado
    const updatedConversation = await conversationService.findById(conversation._id);
    const finalContext = updatedConversation?.context ?? updatedContext;

    const reply = replyComposer.compose(newState, finalContext);
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
    };
  }

  /**
   * Verifica si el estado actual es un estado de pregunta
   */
  private isQuestionState(state: ConversationState): boolean {
    const QUESTION_STATES: ConversationState[] = [
      'need_type_asked',
      'detail_asked',
      'customer_type_asked',
      'urgency_asked',
      'location_asked',
      'equipment_asked',
    ];
    return QUESTION_STATES.includes(state);
  }
}
