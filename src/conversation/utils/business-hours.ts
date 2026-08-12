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
export const FAREWELL_MESSAGES = {
  leadConfirmed: composeFarewellMessage(`✅ ¡Perfecto!

Ya registramos tu solicitud correctamente.

En los próximos minutos un asesor de *Rolo Climatización S.R.L* continuará la conversación para ayudarte.`),

  leadWaiting: composeFarewellMessage(`👋 Gracias por tu mensaje.

Tu solicitud ya fue registrada correctamente.

Un asesor continuará la conversación lo antes posible.`),

  leadWaitingPriority: composeFarewellMessage(`⚠️👋 Gracias por tu mensaje.

Tu solicitud ya fue registrada correctamente.

📩 Tu mensaje ha sido marcado como prioritario.`),

  clientWaiting: composeFarewellMessage(`✨ Gracias por contactarnos.

Un asesor de Rolo Climatización S.R.L te atenderá personalmente.

¡Te respondemos en breve! 😊`),

  clientWaitingPriority: composeFarewellMessage(`⚠️✨ Gracias por contactarnos.

Un asesor de Rolo Climatización S.R.L te atenderá personalmente.

📩 Tu mensaje ha sido marcado como prioritario.`),
};