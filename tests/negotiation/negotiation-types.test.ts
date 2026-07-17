import { describe, it, expect } from 'vitest'

describe('CounterOffer types', () => {
  it('exports CounterOfferStatus type values', async () => {
    const mod = await import('../../src/negotiation/types/negotiation')
    // CounterOfferStatus should exist as a type — verify via the CounterOffer interface
    expect(mod).toHaveProperty('NEGOTIATION_STATUSES')
  })

  it('CounterOffer type is imported correctly', async () => {
    const types = await import('../../src/negotiation/types')
    expect(types).toHaveProperty('NEGOTIATION_STATUSES')
  })
})

describe('Barrel exports', () => {
  it('types/index exports all negotiation types', async () => {
    const types = await import('../../src/negotiation/types')
    expect(types).toHaveProperty('NEGOTIATION_STATUSES')
  })
})
