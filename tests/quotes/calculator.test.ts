import { describe, it, expect } from 'vitest';
import {
  calculateSubtotal,
  calculateTotal,
  processItems,
} from '../../src/quotes/helpers/calculator';

describe('Calculator', () => {
  describe('calculateSubtotal', () => {
    it('sums quantity * unitPrice for all items', () => {
      const result = calculateSubtotal([
        { quantity: 2, unitPrice: 100 },
        { quantity: 3, unitPrice: 50 },
      ]);
      expect(result).toBe(350);
    });

    it('returns 0 for empty array', () => {
      expect(calculateSubtotal([])).toBe(0);
    });
  });

  describe('calculateTotal', () => {
    it('calculates subtotal - discount + tax', () => {
      expect(calculateTotal(1000, 100, 50)).toBe(950);
    });

    it('defaults discount and tax to 0', () => {
      expect(calculateTotal(500)).toBe(500);
    });
  });

  describe('processItems', () => {
    it('transforms CreateQuoteItemInput to IQuoteItem', () => {
      const items = [
        { description: 'Item A', type: 'product' as const, quantity: 2, unitPrice: 100 },
        { description: 'Item B', type: 'service' as const, quantity: 1, unitPrice: 300 },
      ];
      const result = processItems(items);
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        description: 'Item A',
        type: 'product',
        quantity: 2,
        unitPrice: 100,
        subtotal: 200,
      });
      expect(result[1]).toEqual({
        description: 'Item B',
        type: 'service',
        quantity: 1,
        unitPrice: 300,
        subtotal: 300,
      });
    });

    it('calculates item.subtotal = quantity * unitPrice', () => {
      const items = [
        { description: 'Item X', type: 'material' as const, quantity: 3, unitPrice: 150 },
      ];
      const result = processItems(items);
      expect(result[0].subtotal).toBe(450);
    });
  });
});
