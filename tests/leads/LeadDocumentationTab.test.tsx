// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LeadDocumentationTab } from '../../src/leads/components/detail/LeadDocumentationTab';
import { WHATSAPP_SEND_ERROR, PHONE_MISSING_ERROR } from '../../src/leads/helpers/lead-document-delivery';

const SEND_DOCUMENT_URL = '/api/webhook/whatsapp/send-document';
const DOC_ACTION_URL = '/api/crm/leads/lead-1/documents/doc-1/action';
const REMITOS_POST_URL = '/api/crm/remitos';

const hoisted = vi.hoisted(() => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiDel: vi.fn(),
}));

vi.mock('@/lib/api-client', () => ({
  api: {
    get: hoisted.apiGet,
    post: hoisted.apiPost,
    put: vi.fn(),
    patch: vi.fn(),
    del: hoisted.apiDel,
    delete: vi.fn(),
  },
}));

function makeDoc(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'doc-1',
    filename: 'presupuesto.pdf',
    title: 'Presupuesto instalación - 30/08/2026',
    description: '',
    documentType: 'presupuesto',
    mimeType: 'application/pdf',
    fileSize: 20480,
    secureUrl: 'https://res.cloudinary.com/tenant/presupuesto.pdf',
    cloudinaryPublicId: 'doc-1',
    source: 'crm',
    createdAt: '2026-08-29T14:00:00.000Z',
    ...overrides,
  };
}

function makeQuote(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'quote-1',
    sourceDocumentId: 'doc-1',
    status: 'sent',
    saleType: 'service',
    sentAt: '2026-08-29T15:00:00.000Z',
    ...overrides,
  };
}

function makeRemito(overrides: Record<string, unknown> = {}) {
  return {
    _id: 'remito-1',
    sourceDocumentId: 'doc-1',
    status: 'sent',
    sentAt: '2026-08-29T15:00:00.000Z',
    title: 'Remito 0001',
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function setupApi(options: {
  documents?: any[];
  quotes?: any[];
  remitos?: any[];
  sendDocumentResult?: 'ok' | 'server-error' | 'network-error' | 'deferred';
  deferred?: ReturnType<typeof createDeferred<unknown>>;
}) {
  const docs = options.documents ?? [];
  const quotes = options.quotes ?? [];
  let remitos = options.remitos ?? [];

  hoisted.apiGet.mockImplementation((url: string) => {
    if (url.includes('/api/crm/documents')) return Promise.resolve({ documents: docs });
    if (url.includes('/api/crm/quotes')) return Promise.resolve({ data: quotes });
    if (url.includes('/api/crm/remitos')) return Promise.resolve({ data: remitos });
    return Promise.resolve({});
  });

  hoisted.apiPost.mockImplementation((url: string) => {
    if (url === SEND_DOCUMENT_URL) {
      if (options.sendDocumentResult === 'server-error') {
        return Promise.reject(new Error('Meta outage'));
      }
      if (options.sendDocumentResult === 'network-error') {
        return Promise.reject(new TypeError('Failed to fetch'));
      }
      if (options.sendDocumentResult === 'deferred') {
        return options.deferred!.promise;
      }
      return Promise.resolve({ message: {} });
    }
    if (String(url).includes('/api/crm/remitos')) {
      const body = apiPostMockBodyOfLastCall();
      if (body && typeof body === 'object' && 'documentId' in body) {
        remitos = [makeRemito({ sourceDocumentId: (body as any).documentId })];
      }
      return Promise.resolve({ remitoId: 'remito-1', status: 'sent' });
    }
    if (isDocActionUrl(url)) {
      return Promise.resolve({ success: true, newStatus: 'quote_sent', quoteId: 'quote-1' });
    }
    return Promise.resolve({});
  });
}

function apiPostMockBodyOfLastCall() {
  const calls = hoisted.apiPost.mock.calls;
  const last = calls[calls.length - 1];
  return last ? last[1] : undefined;
}

function callsFor(mock: any, predicate: (url: unknown) => boolean) {
  return mock.mock.calls.filter(([url]: [unknown]) => predicate(url));
}

const isDocActionUrl = (u: unknown) => String(u).includes('/documents/') && String(u).endsWith('/action');

describe('LeadDocumentationTab — presupuesto delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders "Presupuesto enviado" badge and no send button when the quote is sent', async () => {
    setupApi({ documents: [makeDoc()], quotes: [makeQuote()], remitos: [] });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    await screen.findByText('Presupuesto enviado');
    expect(screen.queryByRole('button', { name: 'Enviar Presupuesto' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reenviar' })).toBeNull();
  });

  it('renders the "Enviar Presupuesto" button when no quote exists', async () => {
    setupApi({ documents: [makeDoc()], quotes: [], remitos: [] });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    expect(await screen.findByRole('button', { name: 'Enviar Presupuesto' })).toBeDefined();
  });

  it('shows the WhatsApp hard-fail error and does not call doc-action when send-document fails (non-2xx)', async () => {
    const user = userEvent.setup();
    setupApi({
      documents: [makeDoc()],
      quotes: [],
      remitos: [],
      sendDocumentResult: 'server-error',
    });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    await user.click(await screen.findByRole('button', { name: 'Enviar Presupuesto' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const errors1 = await screen.findAllByText(WHATSAPP_SEND_ERROR);
    expect(errors1.length).toBeGreaterThan(0);
    expect(callsFor(hoisted.apiPost, u => isDocActionUrl(u))).toHaveLength(0);
    expect(screen.queryByText('Presupuesto enviado correctamente')).toBeNull();
  });

  it('shows the WhatsApp hard-fail error and does not call doc-action when the request rejects (network failure)', async () => {
    const user = userEvent.setup();
    setupApi({
      documents: [makeDoc()],
      quotes: [],
      remitos: [],
      sendDocumentResult: 'network-error',
    });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    await user.click(await screen.findByRole('button', { name: 'Enviar Presupuesto' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const errors1 = await screen.findAllByText(WHATSAPP_SEND_ERROR);
    expect(errors1.length).toBeGreaterThan(0);
    expect(callsFor(hoisted.apiPost, u => isDocActionUrl(u))).toHaveLength(0);
  });

  it('shows the missing-phone error and calls neither send-document nor doc-action when the lead has no phone', async () => {
    const user = userEvent.setup();
    setupApi({ documents: [makeDoc()], quotes: [], remitos: [] });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="" />);

    await user.click(await screen.findByRole('button', { name: 'Enviar Presupuesto' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const phoneErrors = await screen.findAllByText(PHONE_MISSING_ERROR);
    expect(phoneErrors.length).toBeGreaterThan(0);
    expect(callsFor(hoisted.apiPost, u => u === SEND_DOCUMENT_URL)).toHaveLength(0);
    expect(callsFor(hoisted.apiPost, u => isDocActionUrl(u))).toHaveLength(0);
  });

  it('sends WhatsApp first with sanitized phone and leadId, then doc-action, reloads quotes and notifies the parent', async () => {
    const user = userEvent.setup();
    const onStatusChange = vi.fn();
    setupApi({ documents: [makeDoc()], quotes: [], remitos: [] });
    render(
      <LeadDocumentationTab leadId="lead-1" leadPhone="+54 9 11 2345-6789" onStatusChange={onStatusChange} />,
    );

    await user.click(await screen.findByRole('button', { name: 'Enviar Presupuesto' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    await screen.findByText('Presupuesto enviado correctamente');

    const sendCalls = callsFor(hoisted.apiPost, u => u === SEND_DOCUMENT_URL);
    const actionCalls = callsFor(hoisted.apiPost, u => isDocActionUrl(u));
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][1]).toEqual({
      url: 'https://res.cloudinary.com/tenant/presupuesto.pdf',
      to: '+5491123456789',
      caption: 'Presupuesto instalación - 30/08/2026',
      leadId: 'lead-1',
      mimeType: 'application/pdf',
    });
    expect(actionCalls).toHaveLength(1);
    expect(actionCalls[0][1]).toEqual({ action: 'quote_sent' });

    const allPostUrls = hoisted.apiPost.mock.calls.map(([u]) => u);
    expect(allPostUrls.indexOf(SEND_DOCUMENT_URL)).toBeLessThan(allPostUrls.indexOf(DOC_ACTION_URL));

    await waitFor(() => {
      expect(callsFor(hoisted.apiGet, u => String(u).includes('/api/crm/quotes')).length).toBeGreaterThanOrEqual(2);
    });
    expect(onStatusChange).toHaveBeenCalledWith('quote_sent');
  });

  it('double-tap on Confirm triggers exactly one send-document and one doc-action', async () => {
    const user = userEvent.setup();
    const deferred = createDeferred<unknown>();
    setupApi({
      documents: [makeDoc()],
      quotes: [],
      remitos: [],
      sendDocumentResult: 'deferred',
      deferred,
    });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    await user.click(await screen.findByRole('button', { name: 'Enviar Presupuesto' }));
    const confirmButton = screen.getByRole('button', { name: 'Confirmar' });
    await user.dblClick(confirmButton);

    await act(async () => {
      deferred.resolve({ message: {} });
    });

    await screen.findByText('Presupuesto enviado correctamente');
    expect(callsFor(hoisted.apiPost, u => u === SEND_DOCUMENT_URL)).toHaveLength(1);
    expect(callsFor(hoisted.apiPost, u => isDocActionUrl(u))).toHaveLength(1);
  });
});

describe('LeadDocumentationTab — remito delivery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders the "Enviado" badge and no send button when the remito is sent', async () => {
    const remitoDoc = makeDoc({ _id: 'doc-rem', documentType: 'remito', title: 'Remito 0001' });
    setupApi({
      documents: [remitoDoc],
      quotes: [],
      remitos: [makeRemito({ sourceDocumentId: 'doc-rem' })],
    });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    const badge = await screen.findByText(/^Enviado/);
    expect(badge.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);
    expect(screen.queryByRole('button', { name: 'Enviar remito' })).toBeNull();
  });

  it('renders the "Enviar remito" button when the remito has no sent record', async () => {
    const remitoDoc = makeDoc({ _id: 'doc-rem', documentType: 'remito', title: 'Remito 0001' });
    setupApi({ documents: [remitoDoc], quotes: [], remitos: [] });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    expect(await screen.findByRole('button', { name: 'Enviar remito' })).toBeDefined();
  });

  it('sends WhatsApp, creates the remito record with leadId, reloads remitos and shows the "Enviado" badge', async () => {
    const user = userEvent.setup();
    const remitoDoc = makeDoc({ _id: 'doc-rem', documentType: 'remito', title: 'Remito 0001' });
    setupApi({ documents: [remitoDoc], quotes: [], remitos: [] });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+54 9 11 2345-6789" />);

    await user.click(await screen.findByRole('button', { name: 'Enviar remito' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const badge = await screen.findByText(/^Enviado/);
    expect(badge.textContent).toMatch(/\d{2}\/\d{2}\/\d{4}/);

    const sendCalls = callsFor(hoisted.apiPost, u => u === SEND_DOCUMENT_URL);
    const remitoPostCalls = callsFor(hoisted.apiPost, u => String(u).includes(REMITOS_POST_URL));
    expect(sendCalls).toHaveLength(1);
    expect(sendCalls[0][1]).toEqual({
      url: 'https://res.cloudinary.com/tenant/presupuesto.pdf',
      to: '+5491123456789',
      caption: 'Remito 0001',
      leadId: 'lead-1',
      mimeType: 'application/pdf',
    });
    expect(remitoPostCalls).toHaveLength(1);
    expect(remitoPostCalls[0][1]).toEqual({ documentId: 'doc-rem', leadId: 'lead-1' });

    const allPostUrls = hoisted.apiPost.mock.calls.map(([u]) => u);
    expect(allPostUrls.indexOf(SEND_DOCUMENT_URL)).toBeLessThan(allPostUrls.indexOf(REMITOS_POST_URL));

    await waitFor(() => {
      expect(callsFor(hoisted.apiGet, u => String(u).includes('/api/crm/remitos')).length).toBeGreaterThanOrEqual(2);
    });
  });

  it('blocks the remito send when WhatsApp fails and does not POST /api/crm/remitos', async () => {
    const user = userEvent.setup();
    const remitoDoc = makeDoc({ _id: 'doc-rem', documentType: 'remito', title: 'Remito 0001' });
    setupApi({
      documents: [remitoDoc],
      quotes: [],
      remitos: [],
      sendDocumentResult: 'server-error',
    });
    render(<LeadDocumentationTab leadId="lead-1" leadPhone="+5491123456789" />);

    await user.click(await screen.findByRole('button', { name: 'Enviar remito' }));
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));

    const remitoErrors = await screen.findAllByText(WHATSAPP_SEND_ERROR);
    expect(remitoErrors.length).toBeGreaterThan(0);
    expect(callsFor(hoisted.apiPost, u => String(u).includes(REMITOS_POST_URL))).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Enviar remito' })).not.toBeNull();
  });
});