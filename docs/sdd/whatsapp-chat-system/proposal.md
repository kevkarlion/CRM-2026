# SDD Change Proposal: WhatsApp Chat System

**Change Name**: `whatsapp-chat-system`
**Date**: 2026-07-26
**Status**: Proposed

---

## 1. Executive Summary

Build a unified WhatsApp command center for managing conversations with leads. The system provides a 3-panel layout (lead list, chat view, lead data) and adds a WhatsApp button to pipeline cards for quick access. Message history is stored via the existing `WhatsAppMessage` model, and send functionality uses the existing `WhatsAppService`. The system is UI-complete now; real WhatsApp integration is plugged in later.

---

## 2. Intent & Scope

### 2.1 User Intent

> "I want a WhatsApp button on each pipeline card that opens a chat view. A unified 3-panel command center where I can see my leads, chat with them, and see their data. Build everything now, later just integrate real WhatsApp."

### 2.2 In Scope

| Area | What |
|------|------|
| **WhatsApp Page** | New route `/whatsapp` with 3-panel layout |
| **Left Panel** | Lead list with search, status/temperature filters, unread indicators |
| **Center Panel** | Chat conversation view with message history, send message input |
| **Right Panel** | Lead data card (info, scoring, temperature, recent activities) |
| **Pipeline Button** | WhatsApp icon button on `LeadCard` that navigates to `/whatsapp?leadId=X` |
| **API Endpoints** | GET/POST for chat messages, GET for lead chat list |
| **Mock Mode** | Development mode that simulates messages without real WhatsApp |

### 2.3 Out of Scope

- Real WhatsApp Business API integration (plugs in later via existing `WhatsAppService`)
- Webhook processing changes (already works)
- Media messages (images, audio, video) - text only for v1
- Group chats
- WhatsApp templates
- Read receipts / delivery status

---

## 3. Architecture Approach

### 3.1 Module Structure

Following CRM domain standards (`crm-domain-standards`), create a new `src/whatsapp/` module:

```
src/whatsapp/
├── index.ts                    # Barrel exports
├── types/
│   └── chat.ts                 # Chat-specific types (ChatMessage, ChatLead, etc.)
├── services/
│   └── chat.service.ts         # Chat business logic (extends WhatsAppService)
├── components/
│   ├── WhatsAppPage.tsx        # Main 3-panel container
│   ├── LeadListPanel.tsx       # Left panel - lead list with filters
│   ├── ChatPanel.tsx           # Center panel - conversation view
│   ├── LeadDataPanel.tsx       # Right panel - lead context
│   ├── ChatMessage.tsx         # Single message bubble component
│   ├── ChatInput.tsx           # Message input + send button
│   └── ChatLeadItem.tsx        # Lead item in the list
└── hooks/
    ├── useChatMessages.ts      # Fetch/send messages hook
    └── useChatLeads.ts         # Fetch leads with last message hook
```

### 3.2 API Endpoints

```
src/app/api/crm/whatsapp/
├── messages/route.ts           # GET: messages by leadId, POST: send message
├── leads/route.ts              # GET: leads with last WhatsApp message
└── [leadId]/messages/route.ts  # GET: messages for specific lead
```

### 3.3 Component Architecture (per `crm-component-architecture`)

| Component | Type | Responsibility |
|-----------|------|----------------|
| `WhatsAppPage` | Layout | 3-panel grid layout, state management |
| `LeadListPanel` | Container | Filter logic, lead selection, search |
| `ChatPanel` | Container | Message list, scroll, send logic |
| `LeadDataPanel` | Container | Lead data display, activities |
| `ChatMessage` | UI (atom) | Message bubble rendering (inbound/outbound) |
| `ChatInput` | UI (atom) | Text input + send button |
| `ChatLeadItem` | UI (atom) | Lead row with name, last message, timestamp |

### 3.4 Data Flow

```
Pipeline Card → WhatsApp Button → /whatsapp?leadId=X
                                         ↓
                              WhatsAppPage (loads lead)
                                         ↓
                    ┌────────────────────┼────────────────────┐
                    ↓                    ↓                    ↓
            LeadListPanel         ChatPanel            LeadDataPanel
            (all leads)      (messages for lead)     (lead details)
                    ↓                    ↓                    ↓
            useChatLeads         useChatMessages        fetch /api/crm/leads/[id]
```

---

## 4. Detailed Design

### 4.1 Types (`src/whatsapp/types/chat.ts`)

```typescript
export interface ChatLead {
  leadId: string;
  name: string;
  phone?: string;
  status: string;
  temperature?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  assignedTo?: { name: string; email: string };
}

export interface ChatMessage {
  _id: string;
  leadId: string;
  phone: string;
  direction: 'inbound' | 'outbound';
  content: string;
  type: 'text';
  createdAt: Date;
}

export interface SendMessageInput {
  leadId: string;
  phone: string;
  content: string;
}
```

### 4.2 Service (`src/whatsapp/services/chat.service.ts`)

Extends existing `WhatsAppService` with chat-specific queries:

```typescript
export class ChatService {
  // Get leads with their last WhatsApp message for the list panel
  async getLeadsWithLastMessage(tenantId: string, filters?: ChatFilters): Promise<ChatLead[]>
  
  // Get full message history for a lead
  async getConversation(tenantId: string, leadId: string): Promise<ChatMessage[]>
  
  // Send a message (delegates to WhatsAppService.sendMessage)
  async sendMessage(tenantId: string, input: SendMessageInput, userId: string): Promise<ChatMessage>
}
```

### 4.3 API Endpoints

**GET /api/crm/whatsapp/leads**
- Returns leads with last message, unread count
- Query params: `search`, `status`, `temperature`
- Response: `ChatLead[]`

**GET /api/crm/whatsapp/messages?leadId=X**
- Returns message history for a lead
- Response: `ChatMessage[]`

**POST /api/crm/whatsapp/messages**
- Sends a message
- Body: `{ leadId, phone, content }`
- Response: `ChatMessage` (the saved outbound message)

### 4.4 UI Layout (`WhatsAppPage`)

```
┌──────────────────────────────────────────────────────────────┐
│ WhatsApp — Command Center                          [Filtros] │
├──────────────┬───────────────────────────┬───────────────────┤
│ LEADS        │ CONVERSACIÓN              │ DATOS DEL LEAD    │
│              │                           │                   │
│ 🔍 Buscar... │ ┌─────────────────────┐   │ 👤 Juan Pérez     │
│              │ │ Hola, necesito...   │   │ 📱 +54 11 1234   │
│ ┌──────────┐ │ │         ┌──────────┐│   │ 🌡️ Hot           │
│ │ Juan  🟢 │ │ │         │Hola! 👋  ││   │ 📊 Score: 85     │
│ │ Hola...  │ │ │         └──────────┘│   │                   │
│ │ hace 2m  │ │ │ ┌─────────────────┐ │   │ ACTIVIDADES       │
│ ├──────────┤ │ │ │Necesito un      │ │   │ • Llamada hace 2h │
│ │ María 🔴 │ │ │ │presupuesto      │ │   │ • Lead creado     │
│ │ Gracias  │ │ │ └─────────────────┘ │   │   hace 3 días     │
│ │ hace 1h  │ │ │                     │   │                   │
│ ├──────────┤ │ │                     │   │                   │
│ │ Pedro 🟡 │ │ ├─────────────────────┤   │                   │
│ │ Ok       │ │ │ [Escribir...] [Enviar]│  │                   │
│ │ hace 3h  │ │ └─────────────────────┘   │                   │
│ └──────────┘ │                           │                   │
├──────────────┴───────────────────────────┴───────────────────┤
│ Sidebar                                                      │
└──────────────────────────────────────────────────────────────┘
```

- **Left panel**: `w-72` (288px), scrollable lead list
- **Center panel**: `flex-1`, full height chat with scroll-to-bottom
- **Right panel**: `w-80` (320px), lead data card
- **Responsive**: On mobile, show only active panel with back navigation

### 4.5 Pipeline Card WhatsApp Button

Add to `LeadCard.tsx` a WhatsApp button:

```tsx
// In LeadCard, after the phone link
{lead.phone && (
  <button
    onClick={(e) => {
      e.stopPropagation();
      router.push(`/whatsapp?leadId=${String(lead._id)}`);
    }}
    className="mt-1 flex items-center gap-1 text-xs text-green-600 hover:text-green-700"
    title="Abrir chat WhatsApp"
  >
    <WhatsAppIcon className="w-3.5 h-3.5" />
    Chat
  </button>
)}
```

### 4.6 Chat Message Component

Following UX patterns (`crm-ux-patterns`):

```tsx
// Inbound message (left-aligned, gray bubble)
<div className="flex justify-start">
  <div className="bg-gray-100 rounded-lg px-3 py-2 max-w-[70%]">
    <p className="text-sm text-gray-900">{message.content}</p>
    <span className="text-[10px] text-gray-400">{formatTime(message.createdAt)}</span>
  </div>
</div>

// Outbound message (right-aligned, green bubble)
<div className="flex justify-end">
  <div className="bg-green-50 rounded-lg px-3 py-2 max-w-[70%]">
    <p className="text-sm text-gray-900">{message.content}</p>
    <span className="text-[10px] text-gray-400">{formatTime(message.createdAt)}</span>
  </div>
</div>
```

### 4.7 Mock Mode

For development without real WhatsApp:

```typescript
// In chat.service.ts
const MOCK_MODE = process.env.WHATSAPP_MOCK_MODE === 'true';

if (MOCK_MODE) {
  // Return simulated messages
  // Auto-reply with canned responses
  // Simulate incoming messages after 2-5 seconds
}
```

---

## 5. Implementation Tasks

### Task 1: Types and Service Layer
- Create `src/whatsapp/types/chat.ts`
- Create `src/whatsapp/services/chat.service.ts`
- Create `src/whatsapp/index.ts`

### Task 2: API Endpoints
- Create `src/app/api/crm/whatsapp/leads/route.ts`
- Create `src/app/api/crm/whatsapp/messages/route.ts`

### Task 3: UI Components - Chat Primitives
- Create `ChatMessage.tsx` (message bubble)
- Create `ChatInput.tsx` (text input + send)
- Create `ChatLeadItem.tsx` (lead row in list)

### Task 4: UI Components - Panels
- Create `LeadListPanel.tsx` (left panel with filters)
- Create `ChatPanel.tsx` (center panel with messages)
- Create `LeadDataPanel.tsx` (right panel with lead data)

### Task 5: Main Page and Layout
- Create `WhatsAppPage.tsx` (3-panel container)
- Create route `src/app/(dashboard)/whatsapp/page.tsx`
- Create hooks: `useChatMessages.ts`, `useChatLeads.ts`

### Task 6: Pipeline Card Integration
- Add WhatsApp button to `LeadCard.tsx`
- Add `WhatsAppIcon` SVG component

### Task 7: Mock Mode and Polish
- Implement mock mode in service
- Add loading states (skeletons)
- Add empty states
- Add error handling
- Mobile responsive layout

---

## 6. Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Message ordering (clock skew) | Medium | Use `createdAt` from DB, not client time |
| Performance with many leads | Low | Paginate lead list, lazy load messages |
| Mobile responsive complexity | Medium | Start with desktop-first, add mobile in polish task |
| Mock mode divergence from real API | Low | Mock mode wraps same service interface |
| No real-time (polling only) | Low | 5s polling interval, user accepts this for v1 |

---

## 7. Success Criteria

- [ ] WhatsApp button on pipeline cards navigates to chat
- [ ] 3-panel layout renders correctly on desktop
- [ ] Lead list shows all leads with last message and unread count
- [ ] Chat panel loads message history for selected lead
- [ ] Send message creates outbound message in DB
- [ ] Lead data panel shows lead info, scoring, temperature
- [ ] Mock mode works without real WhatsApp credentials
- [ ] Loading, error, and empty states handled per UX patterns

---

## 8. Dependencies

| Dependency | Type | Notes |
|------------|------|-------|
| `WhatsAppMessage` model | Existing | Already in `src/crm/models/whatsapp-message.ts` |
| `WhatsAppService` | Existing | Already in `src/crm/services/whatsapp.service.ts` |
| `Lead` model | Existing | Already in `src/leads/models/lead.ts` |
| `LeadService` | Existing | For lead data in right panel |
| `Drawer` component | Existing | In `src/lib/components/Drawer.tsx` |
| `@dnd-kit/core` | Existing | Already used in pipeline board |
| Tailwind CSS | Existing | Design system |
