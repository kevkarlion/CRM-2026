/**
 * Maintenance Mode Tests
 * 
 * Tests para verificar el comportamiento del sistema de mantenimiento:
 * 1. Maintenance OFF: usuario normal → CRM funciona, WhatsApp funciona
 * 2. Maintenance ON: usuario normal → CRM bloqueado, WhatsApp mensaje mantenimiento
 * 3. Maintenance ON + usuario autorizado → CRM funciona
 * 4. Maintenance ON + teléfono autorizado → WhatsApp funciona
 */

import { describe, beforeEach, afterAll, it, expect } from 'vitest';
import {
  isMaintenanceMode,
  isMaintenanceBypassEmail,
  isMaintenanceBypassPhone,
  getMaintenanceConfig,
  getMaintenanceWhatsAppMessage,
} from '../maintenance';

// Save original env
const originalEnv = { ...process.env };

describe('Maintenance Mode', () => {
  beforeEach(() => {
    // Reset environment before each test
    Object.assign(process.env, originalEnv);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('isMaintenanceMode', () => {
    it('should return false when MAINTENANCE_MODE is not set', () => {
      delete process.env.MAINTENANCE_MODE;
      expect(isMaintenanceMode()).toBe(false);
    });

    it('should return false when MAINTENANCE_MODE=false', () => {
      process.env.MAINTENANCE_MODE = 'false';
      expect(isMaintenanceMode()).toBe(false);
    });

    it('should return true when MAINTENANCE_MODE=true', () => {
      process.env.MAINTENANCE_MODE = 'true';
      expect(isMaintenanceMode()).toBe(true);
    });
  });

  describe('isMaintenanceBypassEmail', () => {
    it('should return true for any email when maintenance is OFF', () => {
      process.env.MAINTENANCE_MODE = 'false';
      
      expect(isMaintenanceBypassEmail('test@example.com')).toBe(true);
      expect(isMaintenanceBypassEmail('admin@test.com')).toBe(true);
      expect(isMaintenanceBypassEmail(null)).toBe(false);
      expect(isMaintenanceBypassEmail(undefined)).toBe(false);
    });

    it('should return true for authorized email when maintenance is ON', () => {
      process.env.MAINTENANCE_MODE = 'true';
      process.env.MAINTENANCE_ADMIN_EMAIL = 'devweb@patagonia.com';
      
      expect(isMaintenanceBypassEmail('devweb@patagonia.com')).toBe(true);
      expect(isMaintenanceBypassEmail('DEVWEB@PATAGONIA.COM')).toBe(true); // case insensitive
    });

    it('should return false for unauthorized email when maintenance is ON', () => {
      process.env.MAINTENANCE_MODE = 'true';
      process.env.MAINTENANCE_ADMIN_EMAIL = 'devweb@patagonia.com';
      
      expect(isMaintenanceBypassEmail('other@example.com')).toBe(false);
      expect(isMaintenanceBypassEmail(null)).toBe(false);
      expect(isMaintenanceBypassEmail(undefined)).toBe(false);
    });

    it('should return false when no admin email is configured', () => {
      process.env.MAINTENANCE_MODE = 'true';
      delete process.env.MAINTENANCE_ADMIN_EMAIL;
      
      expect(isMaintenanceBypassEmail('any@email.com')).toBe(false);
    });
  });

  describe('isMaintenanceBypassPhone', () => {
    it('should return true for any phone when maintenance is OFF', () => {
      process.env.MAINTENANCE_MODE = 'false';
      
      expect(isMaintenanceBypassPhone('5492984252859')).toBe(true);
      expect(isMaintenanceBypassPhone('+5492984252859')).toBe(true);
      expect(isMaintenanceBypassPhone('2984252859')).toBe(true);
      expect(isMaintenanceBypassPhone(null)).toBe(false);
    });

    it('should return true for authorized phone when maintenance is ON', () => {
      process.env.MAINTENANCE_MODE = 'true';
      process.env.MAINTENANCE_TEST_PHONE = '5492984252859';
      
      // Debe funcionar con formatos que se normalicen correctamente
      expect(isMaintenanceBypassPhone('5492984252859')).toBe(true);
      expect(isMaintenanceBypassPhone('+5492984252859')).toBe(true);
    });

    it('should return false for unauthorized phone when maintenance is ON', () => {
      process.env.MAINTENANCE_MODE = 'true';
      process.env.MAINTENANCE_TEST_PHONE = '5492984252859';
      
      expect(isMaintenanceBypassPhone('5491111111111')).toBe(false);
      expect(isMaintenanceBypassPhone('1234567890')).toBe(false);
      expect(isMaintenanceBypassPhone(null)).toBe(false);
      expect(isMaintenanceBypassPhone(undefined)).toBe(false);
    });

    it('should return false when no test phone is configured', () => {
      process.env.MAINTENANCE_MODE = 'true';
      delete process.env.MAINTENANCE_TEST_PHONE;
      
      expect(isMaintenanceBypassPhone('any-phone')).toBe(false);
    });
  });

  describe('getMaintenanceWhatsAppMessage', () => {
    it('should return the maintenance message', () => {
      const message = getMaintenanceWhatsAppMessage();
      
      expect(message).toContain('mantenimiento');
      expect(message).toContain('🔧');
    });
  });

  describe('getMaintenanceConfig', () => {
    it('should return correct config for maintenance mode ON', () => {
      process.env.MAINTENANCE_MODE = 'true';
      process.env.MAINTENANCE_ADMIN_EMAIL = 'admin@test.com';
      process.env.MAINTENANCE_TEST_PHONE = '5492984252859';
      
      const config = getMaintenanceConfig();
      
      expect(config.mode).toBe(true);
      expect(config.adminEmail).toBe('admin@test.com');
      expect(config.testPhone).toBe('5492984252859');
    });

    it('should return correct config for maintenance mode OFF', () => {
      delete process.env.MAINTENANCE_MODE;
      delete process.env.MAINTENANCE_ADMIN_EMAIL;
      delete process.env.MAINTENANCE_TEST_PHONE;
      
      const config = getMaintenanceConfig();
      
      expect(config.mode).toBe(false);
      expect(config.adminEmail).toBeNull();
      expect(config.testPhone).toBeNull();
    });
  });
});
