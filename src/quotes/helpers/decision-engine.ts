import type {
  DecisionContext,
  DecisionOutput,
  Action,
  PriorityInfo,
} from '../types/decision-engine'

export function evaluateQuoteDecision(context: DecisionContext): DecisionOutput {
  const { quote, lead, negotiation, hasWorkOrder, workOrderStatus } = context

  const actions: Action[] = []
  const warnings: string[] = []
  let priority: PriorityInfo = { level: 'none', label: 'Sin prioridad', description: '' }
  let canConfirmSale = false

  const isExpired = quote.validUntil && new Date(quote.validUntil) < new Date()
  const effectiveStatus = (quote.status === 'sent' && isExpired) ? 'expired' : quote.status

  switch (effectiveStatus) {
    case 'draft':
      actions.push(
        { id: 'edit', label: 'Editar', variant: 'secondary', icon: 'edit' },
        { id: 'send', label: 'Enviar', variant: 'primary', icon: 'send' },
        { id: 'delete', label: 'Eliminar', variant: 'danger', icon: 'trash' },
      )
      break

    case 'sent':
      if (negotiation) {
        actions.push(
          { id: 'approve-quote', label: 'Aprobada', variant: 'secondary', icon: 'check' },
          { id: 'view-negotiation', label: 'Ver Negociación', variant: 'primary', icon: 'eye' },
          { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
          { id: 'duplicate', label: 'Duplicar', variant: 'ghost', icon: 'copy' },
        )
        priority = { level: 'medium', label: 'Negociación activa', description: 'Hay una negociación en curso' }
      } else {
        actions.push(
          { id: 'approve-quote', label: 'Aprobada', variant: 'secondary', icon: 'check' },
          { id: 'start-negotiation', label: 'Iniciar Negociación', variant: 'primary', icon: 'message' },
          { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
          { id: 'duplicate', label: 'Duplicar', variant: 'ghost', icon: 'copy' },
        )
        priority = { level: 'medium', label: 'Esperando respuesta', description: 'Presupuesto enviado al cliente' }
      }

      if (!isExpired && quote.validUntil) {
        const daysUntilExpiry = Math.ceil(
          (new Date(quote.validUntil).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24),
        )
        if (daysUntilExpiry <= 3) {
          priority = { level: 'high', label: 'Próximo a vencer', description: `Vence en ${daysUntilExpiry} día(s)` }
          warnings.push(`El presupuesto vence en ${daysUntilExpiry} día(s).`)
        }
      }
      break

    case 'approved':
      if (lead?.status === 'won') {
        if (hasWorkOrder) {
          if (workOrderStatus === 'draft') {
            actions.push(
              { id: 'edit-work-order', label: 'Editar OT', variant: 'success', icon: 'edit' },
            )
          } else {
            actions.push(
              { id: 'view-work-order', label: 'Ver detalle OT', variant: 'secondary', icon: 'eye' },
            )
          }
          actions.push(
            { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
          )
          priority = { level: 'none', label: 'Venta confirmada', description: 'Ya se creó la Orden de Trabajo' }
        } else {
          actions.push(
            { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
          )
          priority = { level: 'none', label: 'Venta confirmada', description: 'La venta fue confirmada exitosamente' }
        }
        break
      }

      if (!hasWorkOrder && (!negotiation || negotiation.status === 'accepted')) {
        actions.push(
          { id: 'confirm-sale', label: 'Confirmar Venta', variant: 'success', icon: 'check' },
          { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
        )
        canConfirmSale = true
        priority = { level: 'high', label: 'Listo para Confirmar Venta', description: 'Cotización aprobada' }
      } else if (hasWorkOrder) {
        actions.push(
          { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
        )
        priority = { level: 'none', label: 'Venta confirmada', description: 'Ya se creó la Orden de Trabajo' }
      } else {
        actions.push(
          { id: 'download-pdf', label: 'Descargar PDF', variant: 'secondary', icon: 'download' },
        )
        priority = { level: 'medium', label: 'Esperando negociación', description: 'Hay una negociación activa' }
      }
      break

    case 'rejected':
      actions.push(
        { id: 'duplicate', label: 'Duplicar', variant: 'secondary', icon: 'copy' },
        { id: 'download-pdf', label: 'Descargar PDF', variant: 'ghost', icon: 'download' },
      )
      priority = { level: 'low', label: 'Presupuesto rechazado', description: 'Considere crear uno nuevo' }
      break

    case 'expired':
      actions.push(
        { id: 'duplicate', label: 'Duplicar', variant: 'secondary', icon: 'copy' },
        { id: 'download-pdf', label: 'Descargar PDF', variant: 'ghost', icon: 'download' },
      )
      priority = { level: 'low', label: 'Presupuesto vencido', description: 'El presupuesto expiró' }
      break

    case 'cancelled':
      actions.push(
        { id: 'duplicate', label: 'Duplicar', variant: 'secondary', icon: 'copy' },
      )
      priority = { level: 'none', label: 'Presupuesto cancelado', description: '' }
      break
  }

  if (isExpired && quote.status === 'sent') {
    priority = { level: 'urgent', label: 'Presupuesto vencido', description: 'El presupuesto ha vencido' }
    if (!warnings.includes('El presupuesto ha vencido. Considere crear uno nuevo.')) {
      warnings.push('El presupuesto ha vencido. Considere crear uno nuevo.')
    }
  }

  return { actions, priority, warnings, canConfirmSale }
}
