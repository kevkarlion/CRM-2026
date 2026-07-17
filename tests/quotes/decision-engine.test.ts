import { describe, it, expect } from 'vitest'
import { evaluateQuoteDecision } from '../../src/quotes/helpers/decision-engine'
import type { DecisionContext } from '../../src/quotes/types/decision-engine'

function baseQuote(overrides: Partial<DecisionContext['quote']> = {}): DecisionContext['quote'] {
  return {
    _id: 'q1',
    status: 'draft',
    items: [],
    subtotal: 0,
    discountAmount: 0,
    taxAmount: 0,
    total: 0,
    ...overrides,
  }
}

function baseContext(overrides: Partial<DecisionContext> = {}): DecisionContext {
  return {
    quote: baseQuote(),
    lead: null,
    negotiation: null,
    hasWorkOrder: false,
    ...overrides,
  }
}

describe('evaluateQuoteDecision', () => {
  describe('draft status', () => {
    it('returns edit, send, delete actions with none priority', () => {
      const output = evaluateQuoteDecision(baseContext())
      expect(output.actions.map(a => a.id)).toEqual(['edit', 'send', 'delete'])
      expect(output.priority.level).toBe('none')
      expect(output.canConfirmSale).toBe(false)
      expect(output.warnings).toHaveLength(0)
    })
  })

  describe('sent status', () => {
    it('without negotiation shows start-negotiation action', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: new Date('2099-12-31') }),
      }))
      expect(output.actions.map(a => a.id)).toContain('start-negotiation')
      expect(output.actions.map(a => a.id)).toContain('download-pdf')
      expect(output.actions.map(a => a.id)).toContain('duplicate')
      expect(output.priority.level).toBe('medium')
    })

    it('with negotiation shows view-negotiation action', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: new Date('2099-12-31') }),
        negotiation: { _id: 'n1', status: 'open', counterOffersCount: 0 },
      }))
      expect(output.actions.map(a => a.id)).toContain('view-negotiation')
      expect(output.priority.label).toBe('Negociación activa')
    })

    it('expired sent quote shows urgent priority and warning', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: new Date('2020-01-01') }),
      }))
      expect(output.priority.level).toBe('urgent')
      expect(output.warnings).toContain('El presupuesto ha vencido. Considere crear uno nuevo.')
    })

    it('sent quote expiring within 3 days shows high priority', () => {
      const soon = new Date()
      soon.setDate(soon.getDate() + 2)
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: soon }),
      }))
      expect(output.priority.level).toBe('high')
      expect(output.warnings.length).toBeGreaterThan(0)
    })

    it('sent quote with no validUntil shows medium priority', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent' }),
      }))
      expect(output.priority.level).toBe('medium')
    })
  })

  describe('approved status', () => {
    it('without work order and no negotiation shows confirm-sale', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'approved' }),
      }))
      expect(output.actions.map(a => a.id)).toContain('confirm-sale')
      expect(output.canConfirmSale).toBe(true)
      expect(output.priority.level).toBe('high')
    })

    it('without work order and accepted negotiation shows confirm-sale', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'approved' }),
        negotiation: { _id: 'n1', status: 'accepted', counterOffersCount: 1 },
      }))
      expect(output.actions.map(a => a.id)).toContain('confirm-sale')
      expect(output.canConfirmSale).toBe(true)
    })

    it('with active negotiation (not accepted) does not show confirm-sale', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'approved' }),
        negotiation: { _id: 'n1', status: 'counteroffer_made', counterOffersCount: 2 },
      }))
      expect(output.actions.map(a => a.id)).not.toContain('confirm-sale')
      expect(output.canConfirmSale).toBe(false)
      expect(output.priority.label).toBe('Esperando negociación')
    })

    it('with work order shows venta confirmada', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'approved' }),
        hasWorkOrder: true,
      }))
      expect(output.actions.map(a => a.id)).not.toContain('confirm-sale')
      expect(output.canConfirmSale).toBe(false)
      expect(output.priority.label).toBe('Venta confirmada')
    })
  })

  describe('rejected status', () => {
    it('shows duplicate action with low priority', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'rejected' }),
      }))
      expect(output.actions.map(a => a.id)).toEqual(['duplicate', 'download-pdf'])
      expect(output.priority.level).toBe('low')
    })
  })

  describe('expired status', () => {
    it('shows duplicate action with low priority', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'expired' }),
      }))
      expect(output.actions.map(a => a.id)).toEqual(['duplicate', 'download-pdf'])
      expect(output.priority.level).toBe('low')
    })
  })

  describe('cancelled status', () => {
    it('shows only duplicate with none priority', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'cancelled' }),
      }))
      expect(output.actions.map(a => a.id)).toEqual(['duplicate'])
      expect(output.priority.level).toBe('none')
    })
  })

  describe('edge cases', () => {
    it('sent status with expired validUntil is treated as expired', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: new Date('2020-01-01') }),
      }))
      expect(output.priority.level).toBe('urgent')
      expect(output.warnings).toContain('El presupuesto ha vencido. Considere crear uno nuevo.')
    })

    it('draft ignores validUntil for priority (still shows none)', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'draft', validUntil: new Date('2020-01-01') }),
      }))
      expect(output.priority.level).toBe('none')
    })

    it('handles missing lead gracefully', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'draft' }),
        lead: null,
      }))
      expect(output.actions).toHaveLength(3)
    })

    it('handles missing negotiation gracefully', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: new Date('2099-12-31') }),
        negotiation: null,
      }))
      expect(output.actions.map(a => a.id)).toContain('start-negotiation')
    })

    it('all actions have required fields', () => {
      const output = evaluateQuoteDecision(baseContext({
        quote: baseQuote({ status: 'sent', validUntil: new Date('2099-12-31') }),
      }))
      for (const action of output.actions) {
        expect(action.id).toBeTruthy()
        expect(action.label).toBeTruthy()
        expect(['primary', 'secondary', 'danger', 'ghost']).toContain(action.variant)
      }
    })
  })
})
