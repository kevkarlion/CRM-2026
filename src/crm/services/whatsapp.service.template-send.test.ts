import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Types } from 'mongoose';

// Set load-time env vars BEFORE the service module is imported.
// WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID are read at module load.
vi.hoisted(() => {
  process.env.WHATSAPP_ACCESS_TOKEN = 'test-token';
  process.env.WHATSAPP_PHONE_NUMBER_ID = 'test-phone-number-id';
});

// ── Mocks ──────────────────────────────────────────────────────────────────
// We mock the Mongoose models and external deps so we can test the pure logic
// inside WhatsAppService without hitting MongoDB or the Meta API.

vi.mock('@/core/db', () => ({ default: vi.fn(), connectDB: vi.fn() }));
vi.mock('../models/whatsapp-message', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../leads/models/lead', () => ({
  default: { find: vi.fn(), findOne: vi.fn(), findOneAndUpdate: vi.fn() },
}));
vi.mock('../models/client', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../models/contact', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../../core/models/tenant', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('@/clients', () => ({
  ClientServiceHistoryModel: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('@/gestion/models/gestion', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('@/crm/types/activity', () => ({
  EVENT_TYPES: {},
}));
vi.mock('@/timeline/models/timeline-event', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));
vi.mock('../services/whatsapp-template.service', () => ({
  whatsappTemplateService: {
    getTemplate: vi.fn(),
    resolveVariables: vi.fn(),
    getClientForTemplate: vi.fn(),
  },
}));
vi.mock('../../leads/services/lead-score.service', () => ({
  calculateLeadScore: vi.fn(),
}));
vi.mock('@/clients/services/client-score.service', () => ({
  calculateClientScore: vi.fn(),
}));
vi.mock('@/lib/phone', () => ({
  normalizePhone: vi.fn((p: string) => p),
  normalizePhoneForWhatsApp: vi.fn((p: string) => p),
  phoneMatchQuery: vi.fn(),
}));
vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { emit: vi.fn() },
}));
vi.mock('@/infrastructure/events/event.types', () => ({
  DOMAIN_EVENTS: {},
}));
vi.mock('@/conversation', () => ({
  ConversationEngine: vi.fn(),
  getDefaultFlow: vi.fn(),
  conversationResolver: vi.fn(),
  LEAD_QUALIFICATION_FLOW: {},
  CUSTOMER_SERVICE_FLOW: {},
}));
vi.mock('@/conversation/models/conversation', () => ({
  default: { find: vi.fn(), findOne: vi.fn() },
}));

// ── Import AFTER mocks ─────────────────────────────────────────────────────
import { WhatsAppService } from './whatsapp.service';

describe('WhatsAppService.sendTemplateMessage', () => {
  let service: WhatsAppService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new WhatsAppService();
  });

  // Helper: stub the Meta API fetch and the internal saveMessage
  function stubFetchAndSave(fetchResponse: { ok: boolean; json: () => Promise<any> }) {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(fetchResponse as any);
    vi.spyOn(service, 'saveMessage').mockImplementation(async (input: any) => {
      return {
        _id: new Types.ObjectId(),
        ...input,
        processedAt: new Date(),
        createdAt: new Date(),
        save: async () => {},
      } as any;
    });
  }

  // ── Test 1: {{N}} replacement in real template content ────────────────────
  it('replaces {{1}} and {{2}} placeholders with variable values when content is provided', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.abc123' }] }),
    });

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'retomar_contacto',
      variables: { 1: 'Juan', 2: 'presupuesto' },
      content: 'Hola {{1}}, te escribimos por el {{2}}.',
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.content).toBe('Hola Juan, te escribimos por el presupuesto.');
  });

  it('leaves placeholders intact when corresponding variable is missing', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.abc124' }] }),
    });

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'test_template',
      variables: { 1: 'María' },
      content: 'Hola {{1}}, tu número es {{2}}.',
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.content).toBe('Hola María, tu número es {{2}}.');
  });

  // ── Test 2: messageId never empty when API returns no wamid ──────────────
  it('uses noid_<timestamp> fallback when API response has no messages[0].id', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [] }), // no wamid
    });

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'test',
      variables: {},
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.messageId).not.toBe('');
    expect(savedInput.messageId).toMatch(/^noid_\d+$/);
  });

  it('uses actual wamid when API response provides it', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.real123' }] }),
    });

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'test',
      variables: {},
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.messageId).toBe('wamid.real123');
  });

  // ── Test 3: leadId / clientId persistence ─────────────────────────────────
  it('persists leadId when provided in params', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.ok1' }] }),
    });

    const leadObjectId = new Types.ObjectId();
    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'test',
      variables: {},
      leadId: leadObjectId.toHexString(),
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.leadId).toBeInstanceOf(Types.ObjectId);
    expect(savedInput.leadId.toHexString()).toBe(leadObjectId.toHexString());
    expect(savedInput.clientId).toBeUndefined();
  });

  it('persists clientId when provided in params', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.ok2' }] }),
    });

    const clientObjectId = new Types.ObjectId();
    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'test',
      variables: {},
      clientId: clientObjectId.toHexString(),
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.clientId).toBeInstanceOf(Types.ObjectId);
    expect(savedInput.clientId.toHexString()).toBe(clientObjectId.toHexString());
    expect(savedInput.leadId).toBeUndefined();
  });

  // ── Test 4: Fallback to buildTemplatePreview when no content ──────────────
  it('falls back to buildTemplatePreview when content is not provided', async () => {
    stubFetchAndSave({
      ok: true,
      json: async () => ({ messages: [{ id: 'wamid.fallback1' }] }),
    });

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'retomar_contacto',
      variables: { 1: 'Juan', 2: 'presupuesto' },
      // no content
    });

    const savedInput = (service.saveMessage as any).mock.calls[0][0];
    expect(savedInput.content).toBe('[Template: retomar_contacto] Juan | presupuesto');
  });

  // ── Test 5: Header/body component split ──────────────────────────────────
  it('sends header and body components separately when variableSections maps header', async () => {
    let capturedBody: any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: string, init?: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.hb1' }] }),
      } as any;
    });
    vi.spyOn(service, 'saveMessage').mockImplementation(async (input: any) => ({
      _id: new Types.ObjectId(),
      ...input,
      processedAt: new Date(),
      createdAt: new Date(),
      save: async () => {},
    } as any));

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'seguimiento_solicitud',
      variables: { 1: 'Rolo', 2: 'presupuesto' },
      variableSections: { 1: 'header', 2: 'body' },
    });

    expect(capturedBody.template.components).toEqual([
      { type: 'header', parameters: [{ type: 'text', text: 'Rolo' }] },
      { type: 'body', parameters: [{ type: 'text', text: 'presupuesto' }] },
    ]);
  });

  it('sends all variables to body when variableSections is absent (backward compat)', async () => {
    let capturedBody: any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: string, init?: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.bc1' }] }),
      } as any;
    });
    vi.spyOn(service, 'saveMessage').mockImplementation(async (input: any) => ({
      _id: new Types.ObjectId(),
      ...input,
      processedAt: new Date(),
      createdAt: new Date(),
      save: async () => {},
    } as any));

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'retomar_contacto',
      variables: { 1: 'Juan', 2: 'presupuesto' },
    });

    expect(capturedBody.template.components).toEqual([
      {
        type: 'body',
        parameters: [
          { type: 'text', text: 'Juan' },
          { type: 'text', text: 'presupuesto' },
        ],
      },
    ]);
  });

  it('omits components array when there are no variables', async () => {
    let capturedBody: any;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (_url: string, init?: any) => {
      capturedBody = JSON.parse(init.body);
      return {
        ok: true,
        json: async () => ({ messages: [{ id: 'wamid.nov1' }] }),
      } as any;
    });
    vi.spyOn(service, 'saveMessage').mockImplementation(async (input: any) => ({
      _id: new Types.ObjectId(),
      ...input,
      processedAt: new Date(),
      createdAt: new Date(),
      save: async () => {},
    } as any));

    await service.sendTemplateMessage({
      tenantId: '6aa0089b8c118b8d80b245de',
      to: '+5491122334455',
      templateName: 'no_vars',
      variables: {},
    });

    expect(capturedBody.template.components).toBeUndefined();
  });
});
