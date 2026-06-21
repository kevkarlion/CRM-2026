import { IQuoteItem, CreateQuoteItemInput } from '../types/quote-version';

export function calculateSubtotal(items: (IQuoteItem | CreateQuoteItemInput)[]): number {
  return items.reduce((sum, item) => {
    return sum + (item.quantity * item.unitPrice);
  }, 0);
}

export function calculateTotal(
  subtotal: number,
  discountAmount: number = 0,
  taxAmount: number = 0,
): number {
  return subtotal - discountAmount + taxAmount;
}

export function processItems(
  items: CreateQuoteItemInput[],
): IQuoteItem[] {
  return items.map((item) => ({
    description: item.description,
    type: item.type,
    quantity: item.quantity,
    unitPrice: item.unitPrice,
    subtotal: item.quantity * item.unitPrice,
  }));
}
