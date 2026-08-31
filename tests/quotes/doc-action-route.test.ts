import { describe, it, expect, vi, beforeEach } from 'vitest'

const hoisted = vi.hoisted(() => {
  const exec = vi.fn()
  const chain: any = { select: vi.fn(), exec }
  chain.select.mockReturnValue(chain)
  return {
    chain,
    mockConnectDB: vi.fn(),
    mockCreateQuote: vi.fn(),
    mockResolveQuote: vi.fn(),
    mockSendQuote: vi.fn(),
    mockMarkAsDirectSale: vi.fn(),
    mockGetNextWorkOrderNumber: vi.fn(),
    mockQuoteUpdateOne: vi.fn(),
    mockPublish: vi.fn().mockResolvedValue(undefined),
    mockLeadFindById: vi.fn(),
    mockClientFindOne: vi.fn(),
    mockClientUpdateOne: vi.fn(),
  }
})

vi.mock('@/core/db', () => ({
  connectDB: hoisted.mockConnectDB,
}))

vi.mock('@/quotes/services/quote.service', () => {
  class ValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ValidationError'
    }
  }
  class QuoteService {
    createQuote = hoisted.mockCreateQuote
    resolveQuoteBySourceDocument = hoisted.mockResolveQuote
    sendQuote = hoisted.mockSendQuote
    markAsDirectSale = hoisted.mockMarkAsDirectSale
  }
  return { QuoteService, ValidationError }
})

vi.mock('@/documents/models/document', () => ({
  default: { findOne: vi.fn(() => hoisted.chain) },
}))

vi.mock('@/leads/models/lead', () => ({
  default: {
    findById: hoisted.mockLeadFindById,
    findByIdAndUpdate: vi.fn(),
  },
}))

vi.mock('@/crm/models/client', () => ({
  default: {
    findOne: hoisted.mockClientFindOne,
    updateOne: hoisted.mockClientUpdateOne,
  },
}))

vi.mock('@/gestion/models/gestion', () => ({
  default: { findOneAndUpdate: vi.fn() },
}))

vi.mock('@/operations/models/work-order', () => ({
  default: { create: vi.fn() },
}))

vi.mock('@/operations/helpers/counter', () => ({
  getNextWorkOrderNumber: hoisted.mockGetNextWorkOrderNumber,
}))

vi.mock('@/infrastructure/events/event-bus', () => ({
  eventBus: { publish: hoisted.mockPublish },
}))

vi.mock('@/quotes/models/quote', () => ({
  default: { updateOne: hoisted.mockQuoteUpdateOne },
}))

import { POST as leadPOST } from '@/app/api/crm/leads/[id]/documents/[docId]/action/route'
import { POST as clientPOST } from '@/app/api/crm/clients/[id]/documents/[docId]/action/route'
import DocumentModel from '@/documents/models/document'
import WorkOrderModel from '@/operations/models/work-order'

const TENANT = 'aaaaaaaaaaaaaaaaaaaaaaaa'
const USER = 'bbbbbbbbbbbbbbbbbbbbbbbb'
const LEAD = 'cccccccccccccccccccccccc'
const CLIENT = 'dddddddddddddddddddddddd'
const DOC = 'eeeeeeeeeeeeeeeeeeeeeeee'

function leadRequest(body: Record<string, unknown>, tenantId = TENANT) {
  return {
    headers: new Headers({ 'x-tenant-id': tenantId, 'x-user-id': USER }),
    json: vi.fn().mockResolvedValue(body),
  } as any
}

function clientRequest(body: Record<string, unknown>, tenantId = TENANT) {
  return {
    headers: new Headers({ 'x-tenant-id': tenantId, 'x-user-id': USER }),
    json: vi.fn().mockResolvedValue(body),
  } as any
}

function leadParams() {
  return { params: Promise.resolve({ id: LEAD, docId: DOC }) }
}

function clientParams() {
  return { params: Promise.resolve({ id: CLIENT, docId: DOC }) }
}

const documentDoc = { _id: DOC, title: 'Proforma', filename: 'proforma.pdf' }

describe('doc-action routes reuse the source quote by sourceDocumentId', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.mockConnectDB.mockResolvedValue(undefined)
    hoisted.mockGetNextWorkOrderNumber.mockResolvedValue('OT-0001')
    ;(DocumentModel.findOne as ReturnType<typeof vi.fn>).mockReturnValue(hoisted.chain)
    hoisted.chain.exec.mockResolvedValue(documentDoc)
    hoisted.mockLeadFindById.mockResolvedValue({
      _id: LEAD,
      name: 'Lead Name',
      email: 'lead@example.com',
      phone: '555',
      companyName: '',
      customerType: 'residential',
    })
    hoisted.mockClientFindOne.mockResolvedValue({
      _id: CLIENT,
      companyName: 'Client Co',
      fullName: 'Client Co',
      email: 'c@example.com',
      phone: '555',
      customerType: 'residential',
    })
  })

  it('lead won reuses an existing approved quote (no createQuote)', async () => {
    hoisted.mockResolveQuote.mockResolvedValue({ _id: '65a100000000000000000001', status: 'approved', total: 100 })
    hoisted.mockMarkAsDirectSale.mockResolvedValue({ _id: '65a100000000000000000001', status: 'direct_sale', total: 100 })
    ;(WorkOrderModel.create as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: '65b100000000000000000001' }])

    const response = await leadPOST(leadRequest({ action: 'won' }), leadParams())
    const body = await response.json()

    expect(hoisted.mockResolveQuote).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDocumentId: DOC, leadId: LEAD }),
    )
    expect(hoisted.mockCreateQuote).not.toHaveBeenCalled()
    expect(body.quoteId).toBe('65a100000000000000000001')
    expect(hoisted.mockMarkAsDirectSale).toHaveBeenCalledWith('65a100000000000000000001', USER, TENANT, 'service')
    expect(WorkOrderModel.create).toHaveBeenCalled()
    const woArg = (WorkOrderModel.create as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(String(woArg.quoteId)).toBe('65a100000000000000000001')
    expect(hoisted.mockQuoteUpdateOne).toHaveBeenCalled()
  })

  it('lead won creates a quote when none exists (createQuote path)', async () => {
    hoisted.mockResolveQuote.mockResolvedValue(null)
    hoisted.mockCreateQuote.mockResolvedValue({ quote: { _id: '65a100000000000000000002', total: 0 } })
    hoisted.mockMarkAsDirectSale.mockResolvedValue({ _id: '65a100000000000000000002', status: 'direct_sale', total: 0 })
    ;(WorkOrderModel.create as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: '65b100000000000000000002' }])

    const response = await leadPOST(leadRequest({ action: 'won' }), leadParams())
    const body = await response.json()

    expect(hoisted.mockCreateQuote).toHaveBeenCalledTimes(1)
    expect(hoisted.mockCreateQuote).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDocumentId: DOC, leadId: LEAD }),
      USER,
      TENANT,
    )
    expect(body.quoteId).toBe('65a100000000000000000002')
  })

  it('lead quote_sent twice keeps a single quote and is silent on the second send', async () => {
    hoisted.mockResolveQuote.mockResolvedValueOnce(null)
    hoisted.mockCreateQuote.mockResolvedValue({ quote: { _id: '65a100000000000000000004', status: 'draft' } })
    hoisted.mockSendQuote.mockResolvedValue({ _id: '65a100000000000000000004', status: 'sent' })

    const first = await leadPOST(leadRequest({ action: 'quote_sent' }), leadParams())
    expect(first.status).toBe(200)
    expect(hoisted.mockCreateQuote).toHaveBeenCalledTimes(1)
    expect(hoisted.mockSendQuote).toHaveBeenCalledTimes(1)

    hoisted.mockResolveQuote.mockResolvedValueOnce({ _id: '65a100000000000000000004', status: 'sent' })

    const second = await leadPOST(leadRequest({ action: 'quote_sent' }), leadParams())
    const secondJson = await second.json()

    expect(hoisted.mockCreateQuote).toHaveBeenCalledTimes(1)
    expect(hoisted.mockSendQuote).toHaveBeenCalledTimes(1)
    expect(second.status).toBe(200)
    expect(secondJson.success).toBe(true)
  })

  it('client won reuses an existing approved quote (no createQuote)', async () => {
    hoisted.mockResolveQuote.mockResolvedValue({ _id: '65a100000000000000000003', status: 'approved', total: 50 })
    hoisted.mockMarkAsDirectSale.mockResolvedValue({ _id: '65a100000000000000000003', status: 'direct_sale', total: 50 })
    ;(WorkOrderModel.create as ReturnType<typeof vi.fn>).mockResolvedValue([{ _id: '65b100000000000000000003' }])

    const response = await clientPOST(clientRequest({ action: 'won' }), clientParams())
    const body = await response.json()

    expect(hoisted.mockResolveQuote).toHaveBeenCalledWith(
      expect.objectContaining({ sourceDocumentId: DOC, clientId: CLIENT }),
    )
    expect(hoisted.mockCreateQuote).not.toHaveBeenCalled()
    expect(body.quoteId).toBe('65a100000000000000000003')
    const woArg = (WorkOrderModel.create as ReturnType<typeof vi.fn>).mock.calls[0][0][0]
    expect(String(woArg.quoteId)).toBe('65a100000000000000000003')
  })

  it('client quote_sent re-send is silent and preserves the client side-effect', async () => {
    hoisted.mockResolveQuote.mockResolvedValueOnce(null)
    hoisted.mockCreateQuote.mockResolvedValue({ quote: { _id: '65a100000000000000000004', status: 'draft' } })
    hoisted.mockSendQuote.mockResolvedValue({ _id: '65a100000000000000000004', status: 'sent' })

    await clientPOST(clientRequest({ action: 'quote_sent' }), clientParams())
    expect(hoisted.mockCreateQuote).toHaveBeenCalledTimes(1)

    hoisted.mockResolveQuote.mockResolvedValueOnce({ _id: '65a100000000000000000004', status: 'sent' })

    const second = await clientPOST(clientRequest({ action: 'quote_sent' }), clientParams())

    expect(hoisted.mockCreateQuote).toHaveBeenCalledTimes(1)
    expect(hoisted.mockSendQuote).toHaveBeenCalledTimes(1)
    expect(hoisted.mockClientUpdateOne).toHaveBeenCalled()
    expect(second.status).toBe(200)
  })

  it('cross-tenant sourceDocumentId is not reused; a new quote is created', async () => {
    hoisted.mockResolveQuote.mockResolvedValue(null)
    hoisted.mockCreateQuote.mockResolvedValue({ quote: { _id: '65a100000000000000000005', status: 'draft' } })
    hoisted.mockSendQuote.mockResolvedValue({ _id: '65a100000000000000000005', status: 'sent' })

    const response = await leadPOST(leadRequest({ action: 'quote_sent' }, 'ffffffffffffffffffffffff'), leadParams())

    expect(hoisted.mockResolveQuote).toHaveBeenCalledWith(
      expect.objectContaining({ tenantId: 'ffffffffffffffffffffffff', sourceDocumentId: DOC, leadId: LEAD }),
    )
    expect(hoisted.mockCreateQuote).toHaveBeenCalledTimes(1)
    expect(response.status).toBe(200)
  })
})
