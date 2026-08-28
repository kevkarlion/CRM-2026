# Pipeline de WhatsApp Inbound — Bot de Contestación y Recepción en el CRM

> **Estado:** Análisis completo (solo lectura, sin cambios de código).
> **Fecha:** 2026-08-28
> **Referencia:** `docs/architecture/whatsapp-bot-pipeline.md`
> **Cómo ubicarlo:** `.md` dentro de `docs/architecture/`. En el buscador del repo: `whatsapp bot pipeline` o `bot contestación`. También indexado en Engram (obs 1493, topic `architecture/mapa-pipeline-whatsapp-inbound-2-pipelines-paralelos-fsm-7-ramas-vs-engine-legacy`).
> **Objetivo:** Contexto completo del bot de contestación y de cómo el CRM recepciona los mensajes de WhatsApp. Base para cualquier trabajo futuro sobre este flujo.

---

## 0. Resumen Ejecutivo

Existen **DOS pipelines paralelos que no se cruzan**:

| Pipeline | Nombre | Mecanismo | Estado |
|---|---|---|---|
| **A** | FSM de 7 ramas | `processWhatsAppWebhookMessage` → `HandleIncomingMessageUseCase` → `domain/state-machine.ts` | ✅ **PRODUCCIÓN ACTIVA** |
| **B** | Motor de conversación (legacy) | `processIncomingMessage` → `conversationResolver` + `engine.ts` + `config/flows/` + `states/` | 💀 Solo corre en `OLD-route.ts` (muerto, no montado) y `/api/debug/whatsapp/bot-flow` |

La documentación de `sdd/multi-flow-engine` describe el motor (B) como si fuera la arquitectura viva — **no lo es**. El FSM de 7 ramas es el que responde WhatsApp hoy.

---

## 1. Flujo End-to-End

### Pipeline A — Producción activa (FSM de 7 ramas)

```
Meta Webhook
  → POST /api/webhook/whatsapp/route.ts:219  (o bot/route.ts:66)
  → processWhatsAppWebhookMessage()          [webhook-integration.ts:186]
      1. findOrCreateEntity()                [webhook-integration.ts:38]
         - prioridad: Contact(clientId) → Lead → nuevo Lead
         - reactiva leads 'disqualified' → 'contacted'
         - lead.convertedToClient → devuelve clientId
      2. saveInboundMessage()                [webhook-integration.ts:140] → WhatsAppMessageModel
      3. Busca conversación por teléfono (últimos 10 dígitos) o leadId fallback
         - enriquece conversación con datos de cliente [webhook-integration.ts:324-372]
      4. Si conversation.owner === 'OPERATOR' → SKIP bot [webhook-integration.ts:375-384]
      5. BotMessageHandler.handleIncoming()   [bot-message-handler.ts:67]
         → HandleIncomingMessageUseCase.execute() [handle-incoming-message.ts:61]
           - conversationService.findOrCreate() [conversation.service.ts:22]
           - FSM determinista de 7 ramas (domain/state-machine.ts)
           - produce BotAction[] (send_message, update_lead, update_client,
             close_conversation, emit_domain_event, trigger_handoff)
      6. WhatsAppBotAdapter.executeActions() [whatsapp-adapter.ts:25]
         - send_message → whatsappService.sendMessage()
           → POST https://graph.facebook.com/v25.0/{PHONE_NUMBER_ID}/messages
         - update_lead / update_client → findByIdAndUpdate con updatedBy:'whatsapp-bot'
      7. Evento LeadFlowCompleted → LeadModel: status='contacted', score,
         temperature, scoringBreakdown, inquiryReason, priority, location, name
         [webhook-integration.ts:404-459]
```

### Pipeline B — Motor de conversación (solo debug/legacy)

```
whatsappService.processIncomingMessage()     [whatsapp.service.ts:620]
  → saveMessage() → findOrCreateLeadByPhone() [524]
  → processWithEngine() [1012]
      1. conversationResolver.resolveConversation() [conversation-resolver.ts:99]
         - detecta cliente: ContactModel+clientId | lead closed/won
         - CREA Client desde lead won si falta [resolver:171-183]
         - skipBot si lifecycleState IN_PROGRESS owner OPERATOR [resolver:237-266]
         - isComplete → markAsWaitingState → waitingMessage
         - ACTIVE → continue; WAITING → waiting/re-activate; RESOLVED → ventana 72h
      2. engine = CUSTOMER_SERVICE_FLOW | LEAD_QUALIFICATION_FLOW [conversation.service:1101]
      3. Carga customerData: ClientModel (canónico) → LeadModel won (fallback)
      4. engine.start()/process() → Context se persiste en engineData (strict:false)
      5. flow completo de cliente → publish CUSTOMER_FLOW_COMPLETED
         + ClientServiceHistoryModel.create() [whatsapp.service.ts:1277-1323]
      6. Actualiza Lead con datos capturados + score [720-876]
         y Gestion activa con scoring [878-978]
```

**Quién llama a cada pipeline** (verificado por grep):
- `processWhatsAppWebhookMessage` (A): `route.ts`, `bot/route.ts`, `scripts/test-bot-flow.ts`
- `processIncomingMessage` (B): solo `OLD-route.ts:173` (archivo muerto, no montado — no termina en `route.ts`) y `api/debug/whatsapp/bot-flow/route.ts:20`

---

## 2. Mapa de Componentes

| Componente | Ruta | Rol | Pipeline |
|---|---|---|---|
| Webhook POST/GET | `src/app/api/webhook/whatsapp/route.ts` | Verificación + entrada principal | A |
| Webhook bot | `src/app/api/webhook/whatsapp/bot/route.ts` | Variante mínima (parsea interactive/media) | A |
| Webhook legacy | `src/app/api/webhook/whatsapp/OLD-route.ts` | Flujo viejo vía processIncomingMessage — **MUERTO (no montado)** | B |
| Test bot | `src/app/api/webhook/whatsapp/test/route.ts` | Bot local de 4 pasos con Map propio, tenants hardcodeados | — |
| Debug | `src/app/api/debug/whatsapp/bot-flow/route.ts` | Simula processIncomingMessage, send comentado | B |
| Integración | `src/conversation/infrastructure/webhook-integration.ts` | Orquestador pipeline A | A |
| Handler | `src/conversation/infrastructure/bot-message-handler.ts` | Instancia UseCase + isClient()/getClientId() | A |
| Adapter | `src/conversation/infrastructure/whatsapp-adapter.ts` | Ejecuta BotAction[] | A |
| UseCase | `src/conversation/application/handle-incoming-message.ts` | FSM orquestación | A |
| FSM | `src/conversation/domain/state-machine.ts` | TRANSITIONS 7 ramas | A |
| Scoring | `src/conversation/domain/lead-scoring.ts` | urgency 40/20/5, needClarity 20/5/0, customerType 15/10, bonos 15/10/10 | A |
| Handoff | `src/conversation/domain/handoff-policy.ts` | score≥70/hot, userAskedForHuman, fallback 3x, timeout, stuck | A |
| Composer | `src/conversation/domain/reply-composer.ts` | Plantillas por estado (menú "Rolito" 7 opciones) | A |
| Intent | `src/conversation/domain/intent-extractor.ts` | Keywords; **no se usa en el flow actual** (intent vacío fijo) | A |
| Service | `src/conversation/application/conversation.service.ts` | findOrCreate/update (dot-notation context) | A |
| Resolver | `src/conversation/application/conversation-resolver.ts` | skipBot, waiting, reuse 72h, takeControl, markAsResolved | B (y endpoints CRM) |
| Engine | `src/conversation/engine.ts` + config/flows + states/ | Motor de estados (StateRegistry, TransitionPolicy, EngineReplyComposer) | B |
| Store | `MongoDBConversationStore` en whatsapp.service.ts:47 | Persiste engineData (strict:false) | B |
| Servicio central | `src/crm/services/whatsapp.service.ts` | sendMessage, saveMessage, processIncomingMessage, processWithEngine | A+B |
| Chat CRM | `src/crm/services/chat.service.ts` | listConversations + unreadCount (WhatsApp UI) | UI |
| Queries | `src/conversation/infrastructure/conversation-query.service.ts` | listado/detalle/handoffs para CRM | CRM |
| Phone | `src/lib/phone.ts` | normalizePhone, normalizePhoneForWhatsApp, phoneMatchQuery | todos |

---

## 3. Lógica del Bot

### FSM Activo (Pipeline A) — `domain/state-machine.ts` TRANSITIONS

```
idle → greeting_personalized
greeting_personalized → urgency | quote_work | spare_part | general_query | suppliers_info
urgency → detail
detail → address_confirm | location_asked
quote_work / spare_part / general_query → scored
suppliers_info → summary
address_confirm / location_asked → name
name → scored
scored → summary
summary → closed
```

**Guard clauses y overrides en `handle-incoming-message.ts`:**
- `STATE_VALID_OPTIONS` (17-25): greeting 1-7, urgency/priority 1-3, quote_work/spare_part/general_query/suppliers_info 1-2. Opción inválida → reenvía prompt + error (383-402). **FALLBACK ELIMINADO** (`if (false && ...)` en 316; `isNewFlowState = true` en 311/645) — nunca hay handoff por fallback.
- `greeting_personalized` + saludo simple → reenvía menú (163-205)
- Cliente + rama rápida (quote_work/spare_part/general_query) + `scored|evaluate` → **summary** (cierre) (473-476)
- Lead + `address_confirm` → **location_asked** (480-483)
- Cliente SIN dirección en contexto → `location_asked` en vez de confirmar (488-496)
- Lead + `location_asked` → `evaluate` → **name** (500-503); `equipment_asked` → skip a `summary` (506-509)
- Capturas: `urgency` 1→high/2→medium/3→low (214-218); `detail` → needType 'repair' + detail (221-225); `name` → userName (239-243); dirección en location_asked o address_confirm+askingNewAddress (228-235)
- Terminal → `LeadFlowCompleted` SOLO si lead no-cliente (589); cierra conversación, `update_client` con dirección nueva (613-625, 730-755)
- Scoring en `evaluate|scored` (628-758): score + update_lead con status 'contacted', address, scoringBreakdown
- `update_gestion_for_client` **REMOVIDO** (comentado 680-690) — la gestión se crea solo con click "Resuelto"
- `closed` → reinicia tras 48h (96-140); `human_assigned` → no responde (142-144)

### Motor (Pipeline B) — config/flows vs FSM: **NO COINCIDEN**
- `config/lead-qualification.ts`: greeting_personalized→name→service→address→priority→description→evaluate→confirmation
- `config/customer-service.ts`: greeting_personalized→address_confirm→priority→description→evaluate→summary (waiting_operator DEPRECATED)
- verify-report de multi-flow-engine afirma `service_type→address_confirm→description→summary→waiting_operator` — difiere del config actual (sin service_type)

### Resolver (Pipeline B) — decisiones clave
- Prioridad operador: `owner:'OPERATOR' + lifecycleState:'IN_PROGRESS'` → `skipBot: true` (237-266)
- `CONVERSATION_TIMEOUT_MINUTES = 30`; WAITING_OPERATOR nunca expira (679-701)
- Ventana reuso `CONVERSATION_REUSE_WINDOW_MS = 72h` (74, 954-962): cliente → ACTIVE_CLIENT y engine responde; lead → waiting + mensaje (971-1061)
- Prioridad de espera: messageCount ≥3 HIGH, ≥2 MEDIUM (612-619)
- Cliente sin Gestion activa: `needsNewGestion` — pero NO crea gestión (solo al "Resuelto") (217-223)

---

## 4. Modelo de Datos

- **Conversation** — `src/conversation/schemas/conversation.ts`
  - `context` = contextSchema **STRICT** (fields: userName, needType, customerType, urgency, location, equipmentType, detail, + 4 flags booleanos).
  - `engineData` = **strict:false** (para el motor).
  - state enum completo (legacy + 7 ramas); previousState enum **sin** los estados de 7 ramas (se persiste igual porque `runValidators` NO está activado en los updates).
  - lifecycleState: ACTIVE_LEAD/ACTIVE_CLIENT/WAITING_OPERATOR/WAITING_CLIENT/IN_PROGRESS/RESOLVED/CLOSED/EXPIRED; owner BOT|OPERATOR; conversationType lead|customer; waitingMessageCount/Priority/Events; isComplete; lastReadAt; resolvedAt (72h).
- **WhatsAppMessage** — `src/crm/schemas/whatsapp-message.ts`: tenantId, leadId, clientId, phone, messageId (unique), direction, type (text|image|audio|video|document|interactive|unknown), content, status (pending|sent|delivered|read|failed), metadata (mediaId, caption, filename, cloudinaryUrl, pendingDownload), readAt/deliveredAt/failedAt/errorMessage. Índices: tenantId+phone+createdAt, tenantId+leadId+createdAt.
- **Lead** — `src/leads/schemas/lead.ts`: name, companyName, profileName, phone, source ('whatsapp'), status (new→contacted→…→disqualified/won), isClient, convertedToClient, qualificationStatus, inquiryReason (repair|installation|maintenance|spare_parts|budget|other), priority (high|medium|low), address/locality/province, score/temperature/scoringBreakdown, notes, createdBy/updatedBy.
- **Client** — `src/crm/schemas/client.ts`: customerType, status (prospect|active|inactive|blocked), fullName/companyName/profileName, phone, email, address/locality/province, operationStatus, blockHistory, score/temperature, audit createdBy/updatedBy **required**.
- **Contact** — `src/crm/schemas/contact.ts`: clientId (ref), firstName/lastName, phone, isPrimary, audit; índice único parcial tenantId+clientId+email.
- **ClientServiceHistory** — `src/clients/schemas/client-service-history.ts`: serviceType (repair|maintenance|installation|budget|other), address, locality, province, description, status (pending|in_progress|completed|cancelled), createdBy default 'whatsapp-bot'. Creada en whatsapp.service.ts:1308 (pipeline B).
- **Gestion** — `src/gestion/`: creada en `client.service.ts:134` (al crear cliente: status 'contacted') y en `gestion-sync.handler.ts:395/514` (evento CLIENT_RESOLVED al click "Resuelto"). `onCustomerFlowCompleted` (223-268) sincroniza new→contacted — **solo disparado por pipeline B**.
- **TimelineEvent** — el bot crea: "Lead reactivado", "Contacto establecido", handoff, resolución.

---

## 5. Consumo en el CRM

**APIs** (`src/app/api/crm/...`, todas con header `x-tenant-id`):
- `/conversations` GET (listado con lead+preview) y `GET /conversations/[conversationId]` (detalle), `[conversationId]/read` PATCH (lastReadAt), `resolve`, `assign`, `take-control`, `cede-control`, `handoffs`, `customers`, `by-lead/[leadId]`, `by-phone/[phoneNumber]`
- `/whatsapp/conversations` (listConversations de chat.service), `[phone]/messages`, `[phone]/read` (marca inbound como 'read')
- `/clients/with-active-conversation`, `/leads/grouped?pipelineId=`

**Frontend**:
- `PipelineBoard.tsx` (leads pipeline): fetch `/api/crm/leads/grouped` + `/api/crm/conversations/customers` (customers/route.ts — clients + leads won con convData; sort: hasNewActivity primero, línea 212-221); botones resolve (lead→disqualified / client→CLIENT_RESOLVED), assign
- `LeadCard.tsx:246` / `ClientCard.tsx:212` / `GestionCard.tsx:243`: badge "nueva actividad" = `!lastReadAt || lastInboundMessageAt > lastReadAt`
- `LeadChatDrawer.tsx` / `ClientChatDrawer.tsx`: mensajes (por teléfono), `/read`, assign, cede-control, close
- `src/app/(dashboard)/leads/[id]/page.tsx` (take-control/cede-control), `clients/[id]/page.tsx` (take-control → `/resolve` → CLIENT_RESOLVED)
- `src/whatsapp/components/ChatLeadItem.tsx:41-43`: `unreadCount` — definido en chat.service.ts:53-68 = mensajes inbound con status `pending|sent|delivered` (modelo de no-leídos DISTINTO al lastReadAt del pipeline)

---

## 6. Gotchas y Riesgos

1. **🔴 DOS máquinas de estado no coincidentes**: la producción usa `domain/state-machine.ts` (7 ramas) vía HandleIncomingMessageUseCase; el motor (`states/` + `config/flows` + `engine.ts`) solo corre en OLD-route.ts (muerto) y debug. La doc `sdd/multi-flow-engine` describe el motor como arquitectura, pero NO procesa tráfico real.
2. **🔴 `contextSchema` es STRICT y los campos de cliente NO están definidos**: `customerName`, `customerAddress`, `customerLocality`, `customerProvince`, `clientId`, `isCustomer`, `serviceType`, `priority`, `description`, `profileName`, `askingNewAddress` se escriben con dot-notation (`conversation.service.ts:186-192`, `webhook-integration.ts:340-359`) → **Mongoose los descarta silenciosamente en persistencia**. Solo persisten los campos del esquema (userName, needType, urgency, location, detail, …). El engineData (strict:false) NO tiene el problema — asimetría real entre pipelines.
3. **🔴 CUSTOMER_FLOW_COMPLETED solo se dispara en pipeline B** (whatsapp.service.ts:1285) → en producción (pipeline A) el sync de Gestion new→contacted **nunca ocurre** para clientes.
4. **🔴 update_gestion_for_client eliminado** (whatsapp-adapter.ts:42-44) pero `isLeadAlreadyContacted`, `handleWaitingState` y `getActiveGestion` siguen vivos; `GestionCard` aún muestra gestiones. Estado intermedio de migración.
5. **🟠 `scripts/test-bot-flow.ts` obsoleto**: espera estados viejos (need_type_asked, urgency_asked, location_asked, equipment_asked) que no existen en el FSM actual → falla o miente.
6. **🟠 `test/route.ts` es un bot local de 4 pasos divergente** (BotState Map propio) — no usa el pipeline ni FSM ni engine.
7. **🟠 Tenant IDs inconsistentes**: demo `6a45a83e202f4857cebf0e72` (test route, scripts) vs debug `000000000000000000000001` (all-zero, también fallback de `getActiveTenantId` whatsapp.service.ts:289) vs `DEFAULT_USER_ID` `6a45a841202f4857cebf0ed1`.
8. **🟠 Normalización de teléfono heterogénea**: `normalizePhone` (lib/phone.ts) vs `last10Digits` regex (webhook-integration.ts:217, chat.service.ts:118) vs `(549)?${last9}$` (conversation.service.ts:44) vs `phoneMatchQuery`. Resultados ligeramente distintos según el punto.
9. **🟠 Unread duplicado y divergente**: chat.service (status-based) vs pipeline/PipelineBoard (lastReadAt vs lastInboundMessageAt). Dos definiciones de "no leído".
10. **🟠 `isComplete`/`confirmed` chequeados en engineData SOLO en resolver**: `anyActive.isComplete === true || engineData?.complete === true || engineData?.confirmed === true` (resolver:324) — conversaciones creadas sin engineData ni isComplete pueden quedar "colgadas" en ACTIVE.
11. **🟠 `findOrCreateEntity` vs `findOrCreateLeadByPhone` duplican lógica de creación de lead** (una en webhook-integration:38, otra en whatsapp.service:524) con criterios de exclusión distintos (status `$nin ['closed','won']` vs sin filtro de status → el pipeline B puede reusar leads cerrados).
12. **🟠 `OPEN.owner==='OPERATOR'` en webhook-integration (375) vs resolver (IN_PROGRESS, 237)**: pipelines con criterios de skip distintos; si un operador toma control vía pipeline A (conversación sin lifecycleState IN_PROGRESS pero owner OPERATOR), el resolver de pipeline B lo ignoraría.
13. **🟡 `previousState` enum incompleto para estados 7-ramas** — solo no crashea porque `runValidators` está apagado en todos los findByIdAndUpdate del ciclo de vida.

---

## 7. Diferencias de Configuración

| Aspecto | route.ts (prod) | bot/route.ts | OLD-route.ts | test/route.ts | debug |
|---|---|---|---|---|---|
| Pipeline | A (FSM) | A (FSM) | B (engine) — MUERTO | local 4 pasos | B (engine) |
| Entrada | processWhatsAppWebhookMessage | idem | processIncomingMessage | uso local | processIncomingMessage |
| Tenants | header + findOrCreateEntity | idem | `getActiveTenantId` | `6a45a83e202f4857cebf0e72` | `000000000000000000000001` |
| WhatsAppMessage | saveInboundMessage (status 'delivered') | idem | saveMessage (metadata pendingDownload) | propio | saveMessage |
| Flow | greeting 1-7 → ramas | idem | greeting_personalized → name/service/… | old 4 pasos | engine config |

**Env y servicios usados por el bot:**
- `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID` — whatsapp.service.ts:251-252, requeridos en sendMessage (302) y sendTemplateMessage (372); endpoint **Graph API v25.0** (324, 422)
- `WHATSAPP_VERIFY_TOKEN` — route.ts:11 / OLD-route.ts:13 (con fallback hardcodeado)
- `SKIP_WHATSAPP_DB=true` — modo dev sin DB (whatsapp.service.ts:249, saveMessage mock 491-502)
- Media: solo el pipeline B setea `metadata.pendingDownload:true` (645-651); pipeline A guarda metadata mediaId/caption/filename sin flag; existe `/api/webhook/whatsapp/download-media` para el download
- Templates de sesión: `sendTemplateMessage` con preview `[Template: name] var1 | var2` (469-476)

---

## 8. Próximos pasos sugeridos (si se retoma)

- Verificar el stripping de Mongoose en `contextSchema`: confirmar exactamente qué campos se pierden en persistencia vs los que el FSM cree haber guardado.
- Decidir el destino del pipeline B (engine legacy): eliminar, o migrar producción a él (y entonces arreglar la doc de multi-flow-engine).
- Unificar el "no leído" (chat.service vs PipelineBoard).
- Unificar normalización de teléfono en un único helper.
- Retirar artefactos obsoletos: `scripts/test-bot-flow.ts`, `test/route.ts`, tenant debug all-zero.