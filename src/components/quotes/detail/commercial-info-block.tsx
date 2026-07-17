'use client'

interface CommercialInfoBlockProps {
  client?: {
    fullName?: string
    companyName?: string
    email?: string
    phone?: string
  } | null
  lead?: {
    name?: string
    email?: string
    phone?: string
    companyName?: string
    status: string
    pipelineStage?: string
    origin?: string
    responsible?: string
    createdAt?: Date | string
  } | null
}

export function CommercialInfoBlock({ client, lead }: CommercialInfoBlockProps) {
  return (
    <div className="space-y-4">
      {client && (
        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Información del Cliente</h2>

          <dl className="space-y-2 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Nombre</dt>
              <dd className="text-gray-700 font-medium text-right">{client.fullName || '—'}</dd>
            </div>
            {client.companyName && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Empresa</dt>
                <dd className="text-gray-700 text-right">{client.companyName}</dd>
              </div>
            )}
            {client.email && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-700 text-right truncate max-w-[180px]">{client.email}</dd>
              </div>
            )}
            {client.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Teléfono</dt>
                <dd className="text-gray-700 text-right">{client.phone}</dd>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-xl p-5">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">
          {lead ? 'Información del Lead' : 'Información Comercial'}
        </h2>

        {!lead ? (
          <p className="text-sm text-gray-500">Sin datos del Lead asociado</p>
        ) : (
          <dl className="space-y-2 text-sm">
            {lead.name && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Nombre</dt>
                <dd className="text-gray-700 font-medium text-right">{lead.name}</dd>
              </div>
            )}
            {lead.email && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Email</dt>
                <dd className="text-gray-700 text-right truncate max-w-[180px]">{lead.email}</dd>
              </div>
            )}
            {lead.phone && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Teléfono</dt>
                <dd className="text-gray-700 text-right">{lead.phone}</dd>
              </div>
            )}
            {lead.companyName && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Empresa</dt>
                <dd className="text-gray-700 text-right">{lead.companyName}</dd>
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-gray-500">Estado</dt>
              <dd className="text-gray-700 font-medium text-right">{lead.status}</dd>
            </div>
            {lead.pipelineStage && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Etapa Pipeline</dt>
                <dd className="text-gray-700 text-right">{lead.pipelineStage}</dd>
              </div>
            )}
            {lead.origin && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Origen</dt>
                <dd className="text-gray-700 text-right">{lead.origin}</dd>
              </div>
            )}
            {lead.responsible && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Responsable</dt>
                <dd className="text-gray-700 text-right">{lead.responsible}</dd>
              </div>
            )}
            {lead.createdAt && (
              <div className="flex justify-between">
                <dt className="text-gray-500">Fecha Creación</dt>
                <dd className="text-gray-700 text-right">
                  {new Date(lead.createdAt).toLocaleDateString('es-CL')}
                </dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </div>
  )
}
