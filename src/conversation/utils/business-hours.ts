/**
 * Business Hours Utility
 * 
 * Provides consistent business hours messaging for the bot.
 * Used in farewell messages across lead and customer flows.
 */

export const BUSINESS_HOURS = `📅 Horarios de atención:
   • Lunes a viernes: 9:00 a 18:00 hs
   • Sábado: 9:00 a 13:00 hs`;

/**
 * Get business hours footer for farewell messages
 */
export function getBusinessHoursFooter(): string {
  return BUSINESS_HOURS;
}

/**
 * Compose a complete farewell message with business hours
 * @param baseMessage - The main farewell text
 * @returns Complete message with business hours appended
 */
export function composeFarewellMessage(baseMessage: string): string {
  return `${baseMessage}

${BUSINESS_HOURS}`;
}

// Common farewell message templates
// All confirmation messages use the same unified message
const UNIFIED_FAREWELL = `¡Listo! 😊 Ya registré tu solicitud. Un integrante de nuestro equipo se contactará contigo lo antes posible para continuar con la atención. ¡Gracias por comunicarte con Rolo Climatización! 👋`;

export const FAREWELL_MESSAGES = {
  leadConfirmed: composeFarewellMessage(UNIFIED_FAREWELL),

  leadWaiting: composeFarewellMessage(UNIFIED_FAREWELL),

  leadWaitingPriority: composeFarewellMessage(`⚠️¡Listo! 😊 Ya registré tu solicitud.

📩 Tu mensaje ha sido marcado como prioritario. Un integrante de nuestro equipo se contactará contigo lo antes posible.`),

  clientWaiting: composeFarewellMessage(UNIFIED_FAREWELL),

  clientWaitingPriority: composeFarewellMessage(`⚠️¡Listo! 😊 Ya registré tu solicitud.

📩 Tu mensaje ha sido marcado como prioritario. Un integrante de nuestro equipo se contactará contigo lo antes posible.`),
};