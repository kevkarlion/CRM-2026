/**
 * Maintenance Mode - Sistema centralizado de mantenimiento
 * 
 * Proporciona funciones para verificar si el sistema está en modo mantenimiento
 * y si un usuario/número específico tiene bypass.
 * 
 * Variables de entorno:
 * - MAINTENANCE_MODE: 'true' para activar mantenimiento
 * - MAINTENANCE_ADMIN_EMAIL: email del usuario con bypass (CRM)
 * - MAINTENANCE_TEST_PHONE: número de teléfono con bypass (WhatsApp) - formato E.164
 */

import { normalizePhone } from './phone';

interface MaintenanceConfig {
  mode: boolean;
  adminEmail: string | null;
  testPhone: string | null;
}

/**
 * Obtiene la configuración de mantenimiento desde variables de entorno
 */
export function getMaintenanceConfig(): MaintenanceConfig {
  const config = {
    mode: process.env.MAINTENANCE_MODE === 'true',
    adminEmail: process.env.MAINTENANCE_ADMIN_EMAIL || null,
    testPhone: process.env.MAINTENANCE_TEST_PHONE 
      ? normalizePhone(process.env.MAINTENANCE_TEST_PHONE) 
      : null,
  };
  console.log('[Maintenance] Config loaded:', { 
    mode: config.mode, 
    adminEmail: config.adminEmail, 
    testPhone: config.testPhone 
  });
  return config;
}

/**
 * Verifica si el sistema está en modo mantenimiento
 */
export function isMaintenanceMode(): boolean {
  return getMaintenanceConfig().mode;
}

/**
 * Verifica si un email tiene bypass de mantenimiento para el CRM
 */
export function isMaintenanceBypassEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const config = getMaintenanceConfig();
  if (!config.mode) return true; // Si no hay mantenimiento, siempre permite
  return email.toLowerCase() === config.adminEmail?.toLowerCase();
}

/**
 * Verifica si un número de teléfono tiene bypass de mantenimiento para WhatsApp
 */
export function isMaintenanceBypassPhone(phone: string | null | undefined): boolean {
  if (!phone) return false;
  const config = getMaintenanceConfig();
  if (!config.mode) return true; // Si no hay mantenimiento, siempre permite
  
  const normalizedPhone = normalizePhone(phone);
  console.log('[Maintenance] Phone bypass check:', { 
    inputPhone: phone, 
    normalizedPhone, 
    testPhone: config.testPhone, 
    match: normalizedPhone === config.testPhone 
  });
  
  return normalizedPhone === config.testPhone;
}

/**
 * Obtiene el mensaje de mantenimiento para WhatsApp
 */
export function getMaintenanceWhatsAppMessage(): string {
  return '🔧 Estamos realizando tareas de mantenimiento en nuestro sistema. En breve volveremos a estar disponibles. ¡Gracias por tu paciencia!';
}

/**
 * Obtiene el mensaje de mantenimiento para el CRM (HTML simple)
 */
export function getMaintenanceCRMMessage(): string {
  return `
    <div style="text-align: center; padding: 50px 20px; font-family: sans-serif;">
      <h1>🔧 Mantenimiento en progreso</h1>
      <p>Estamos realizando tareas de mantenimiento en nuestro sistema.</p>
      <p>Volveremos a estar disponibles en breve.</p>
      <p style="color: #666; margin-top: 30px;">Gracias por tu paciencia.</p>
    </div>
  `;
}
