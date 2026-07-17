import { describe, it, expect, vi, beforeEach } from 'vitest'

function createChain(defaultExecResult: any = null) {
  const exec = vi.fn().mockResolvedValue(defaultExecResult)
  const chain: any = {
    lean: vi.fn(),
    select: vi.fn(),
    sort: vi.fn(),
    populate: vi.fn(),
    exec,
    then: (resolve: any, reject: any) => exec().then(resolve, reject),
  }
  chain.lean.mockReturnValue(chain)
  chain.select.mockReturnValue(chain)
  chain.sort.mockReturnValue(chain)
  chain.populate.mockReturnValue(chain)
  return chain
}

const hoisted = vi.hoisted(() => ({
  mockConnectDB: vi.fn(),
  mockGetQuote: vi.fn(),
}))

vi.mock('@/core/db', () => ({
  connectDB: hoisted.mockConnectDB,
}))

vi.mock('@/quotes/services', () => ({
  QuoteService: vi.fn().mockImplementation(() => ({
    getQuote: hoisted.mockGetQuote,
  })),
  NotFoundError: class NotFoundError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'NotFoundError'
    }
  },
  ValidationError: class ValidationError extends Error {
    constructor(message: string) {
      super(message)
      this.name = 'ValidationError'
    }
  },
}))

vi.mock('@/leads/models/lead', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('@/negotiation/models/negotiation', () => ({
  default: { findOne: vi.fn() },
}))

vi.mock('@/operations/models/work-order', () => ({
  default: { findOne: vi.fn() },
}))

import { GET } from '@/app/api/crm/quotes/[id]/route'
import LeadModel from '@/leads/models/lead'
import NegotiationModel from '@/negotiation/models/negotiation'
import WorkOrderModel from '@/operations/models/work-order'

function mockRequest(tenantId = 'tenant-1') {
  return {
    headers: new Headers({ 'x-tenant-id': tenantId }),
  } as any
}

function mockParams(id = 'quote-1') {
  return { params: Promise.resolve({ id }) }
}

function setupMocks(leadResult: any = null, negResult: any = null, woResult: any = null) {
  const leadChain = createChain(leadResult)
  const negChain = createChain(negResult)
  const woChain = createChain(woResult)
  ;(LeadModel.findOne as ReturnType<typeof vi.fn>).mockReturnValue(leadChain)
  ;(NegotiationModel.findOne as ReturnType<typeof vi.fn>).mockReturnValue(negChain)
  ;(WorkOrderModel.findOne as ReturnType<typeof vi.fn>).mockReturnValue(woChain)
}

describe('GET /api/crm/quotes/:id', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.mockConnectDB.mockResolvedValue(undefined)
  })

  it('returns enriched response with lead, negotiation, and hasWorkOrder', async () => {
    const quote = {
      _id: 'quote-1',
      leadId: 'lead-1',
      status: 'sent',
      validUntil: new Date('2099-12-31'),
      convertedToWorkOrder: null,
    }
    hoisted.mockGetQuote.mockResolvedValue({ quote, currentVersion: null })

    setupMocks(
      { _id: 'lead-1', status: 'contacted', source: 'call', assignedTo: 'user-1', createdAt: new Date('2025-01-01') },
      { _id: 'neg-1', status: 'open', counterOffers: [{ amount: 100 }], followUp: { nextContactDate: new Date('2025-06-01') }, updatedAt: new Date('2025-05-15') },
      null,
    )

    const response = await GET(mockRequest(), mockParams())
    const body = await response.json()

    expect(body.quote).toBeDefined()
    expect(body.lead._id).toBe('lead-1')
    expect(body.lead.status).toBe('contacted')
    expect(body.lead.origin).toBe('call')
    expect(body.lead.responsible).toBe('user-1')
    expect(body.lead.createdAt).toBeTruthy()
    expect(body.negotiation._id).toBe('neg-1')
    expect(body.negotiation.status).toBe('open')
    expect(body.negotiation.counterOffersCount).toBe(1)
    expect(body.negotiation.lastUpdate).toBeTruthy()
    expect(body.negotiation.nextFollowUp).toBeTruthy()
    expect(body.hasWorkOrder).toBe(false)
  })

  it('returns null lead and negotiation when quote has no leadId', async () => {
    const quote = {
      _id: 'quote-2',
      leadId: null,
      status: 'draft',
      convertedToWorkOrder: null,
    }
    hoisted.mockGetQuote.mockResolvedValue({ quote, currentVersion: null })
    setupMocks(null, null, null)

    const response = await GET(mockRequest(), mockParams('quote-2'))
    const body = await response.json()

    expect(body.lead).toBeNull()
    expect(body.negotiation).toBeNull()
    expect(body.hasWorkOrder).toBe(false)
  })

  it('returns hasWorkOrder true when convertedToWorkOrder exists', async () => {
    const quote = {
      _id: 'quote-3',
      leadId: 'lead-1',
      status: 'approved',
      convertedToWorkOrder: 'wo-1',
    }
    hoisted.mockGetQuote.mockResolvedValue({ quote, currentVersion: null })
    setupMocks(null, null, { _id: 'wo-1' })

    const response = await GET(mockRequest(), mockParams('quote-3'))
    const body = await response.json()

    expect(body.hasWorkOrder).toBe(true)
  })

  it('returns 500 when quote service throws', async () => {
    hoisted.mockGetQuote.mockRejectedValue(new Error('Cotización no encontrada'))
    setupMocks(null, null, null)

    const response = await GET(mockRequest(), mockParams('missing'))
    expect(response.status).toBe(500)
  })

  it('returns 401 when tenant header is missing', async () => {
    const response = await GET(mockRequest(''), mockParams())
    expect(response.status).toBe(401)
  })

  it('returns negotiation with zero counterOffersCount when no counter offers', async () => {
    const quote = {
      _id: 'quote-4',
      leadId: null,
      status: 'sent',
      convertedToWorkOrder: null,
    }
    hoisted.mockGetQuote.mockResolvedValue({ quote, currentVersion: null })
    setupMocks(null, { _id: 'neg-2', status: 'accepted', counterOffers: [], updatedAt: new Date('2025-05-15') }, null)

    const response = await GET(mockRequest(), mockParams('quote-4'))
    const body = await response.json()

    expect(body.negotiation.counterOffersCount).toBe(0)
    expect(body.negotiation.nextFollowUp).toBeUndefined()
  })
})
