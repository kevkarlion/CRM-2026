import { describe, it, expect } from 'vitest';

describe('Gestion Schema - isVisible fields', () => {
  it('gestion schema has isVisible field', async () => {
    const { gestionSchema } = await import('../../src/gestion/schemas/gestion');
    const paths = Object.keys(gestionSchema.paths);

    expect(paths).toContain('isVisible');
  });

  it('gestion schema has visibleAt field', async () => {
    const { gestionSchema } = await import('../../src/gestion/schemas/gestion');
    const paths = Object.keys(gestionSchema.paths);

    expect(paths).toContain('visibleAt');
  });

  it('gestion schema has correct index on isVisible and status', async () => {
    const { gestionSchema } = await import('../../src/gestion/schemas/gestion');
    const indexes = gestionSchema.indexes();

    // Check for compound index on tenantId + isVisible + status
    const hasCorrectIndex = indexes.some((idx: [Record<string, number>, unknown]) => {
      const [key] = idx;
      return (
        key.tenantId === 1 &&
        key.isVisible === 1 &&
        key.status === 1
      );
    });

    expect(hasCorrectIndex).toBe(true);
  });
});

describe('Gestion Service - Pipeline Loop Methods', () => {
  it('should have createHidden method', async () => {
    const { GestionService } = await import('../../src/gestion/services/gestion.service');
    
    const service = new GestionService();
    
    // Verify the method exists
    expect(typeof service.createHidden).toBe('function');
  });

  it('should have activateGestion method', async () => {
    const { GestionService } = await import('../../src/gestion/services/gestion.service');
    
    const service = new GestionService();
    
    // Verify the method exists
    expect(typeof service.activateGestion).toBe('function');
  });

  it('should have resolveGestion method', async () => {
    const { GestionService } = await import('../../src/gestion/services/gestion.service');
    
    const service = new GestionService();
    
    // Verify the method exists
    expect(typeof service.resolveGestion).toBe('function');
  });
});

describe('Client Schema - Removed deprecated fields', () => {
  it('client schema does not have operationStatus field', async () => {
    const { clientSchema } = await import('../../src/crm/schemas/client');
    const paths = Object.keys(clientSchema.paths);

    expect(paths).not.toContain('operationStatus');
  });

  it('client schema does not have score field', async () => {
    const { clientSchema } = await import('../../src/crm/schemas/client');
    const paths = Object.keys(clientSchema.paths);

    expect(paths).not.toContain('score');
  });

  it('client schema does not have temperature field', async () => {
    const { clientSchema } = await import('../../src/crm/schemas/client');
    const paths = Object.keys(clientSchema.paths);

    expect(paths).not.toContain('temperature');
  });
});