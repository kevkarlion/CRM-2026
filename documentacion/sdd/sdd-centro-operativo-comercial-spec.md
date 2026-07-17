# SDD Specification: Centro Operativo Comercial

> **Change name**: `centro-operativo-comercial`
> **Estado**: Spec (v1.0.0)
> **Topic key**: `sdd/centro-operativo-comercial/spec`
> **Basado en**: `sdd-centro-operativo-comercial-proposal.md` v1.0.0

---

## 1. Requirements

### 1.1 Executive Summary (REQ-ES)

Barra horizontal con 4 indicadores calculados al vuelo desde los datos actuales de Quotes y Negotiations.

#### REQ-ES-01: Indicador de cotizaciones activas

**Descripción**: El sistema DEBE mostrar el conteo de Quotes con status `draft` o `sent`.

**Criterios de aceptación**:
- El valor DEBE calcularse como `count` de Quotes donde `status` sea `draft` o `sent`.
- El indicador DEBE mostrar el número total precedido por el label "Cotizaciones activas".
- El valor DEBE actualizarse cada vez que la página se renderiza o los datos cambian.
- Si el conteo es 0, DEBE mostrarse "0" (nunca ocultar el indicador).

**Prioridad**: Must have

#### REQ-ES-02: Indicador de negociaciones pendientes

**Descripción**: El sistema DEBE mostrar el conteo de Negotiations con status `open` o `counteroffer_made`.

**Criterios de aceptación**:
- El valor DEBE calcularse como `count` de Negotiations donde `status` sea `open` o `counteroffer_made`.
- El indicador DEBE mostrar el número total precedido por el label "Negociaciones pendientes".

**Prioridad**: Must have

#### REQ-ES-03: Indicador de tasa de conversión

**Descripción**: El sistema DEBE mostrar el porcentaje de conversión calculado como `approved / (sent + approved + rejected) * 100`.

**Criterios de aceptación**:
- El numerador DEBE ser Quotes con `status === 'approved'`.
- El denominador DEBE ser Quotes con `status` en `['sent', 'approved', 'rejected']`.
- El resultado DEBE mostrarse como porcentaje entero (ej. "67%").
- Si el denominador es 0, DEBE mostrarse "—" (em dash).
- El indicador DEBE mostrar el label "Tasa de conversión".

**Prioridad**: Must have

#### REQ-ES-04: Indicador de valor potencial total

**Descripción**: El sistema DEBE mostrar la suma total de Quotes con status `draft` o `sent`.

**Criterios de aceptación**:
- El valor DEBE calcularse como `sum(total)` de Quotes donde `status` sea `draft` o `sent`.
- El monto DEBE formatearse en CLP usando `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`.
- El indicador DEBE mostrar el label "Valor potencial total".

**Prioridad**: Should have

---

### 1.2 Work Tray (REQ-WT)

Sección que muestra "qué necesita tu atención ahora mismo", con hasta 3 categorías y máximo 3 items por categoría.

#### REQ-WT-01: Cotizaciones por vencer

**Descripción**: El sistema DEBE mostrar una sección con Quotes en estado `sent` cuyo `validUntil` esté entre hoy y hoy+7 días.

**Criterios de aceptación**:
- DEBE filtrar Quotes con `status === 'sent'` y `validUntil >= today && validUntil <= today+7`.
- DEBE mostrar máximo 3 items. Si hay más, DEBE indicar "y N más" al final.
- Cada item DEBE mostrar nombre del cliente, monto y fecha de vencimiento.
- Cada item DEBE ser un enlace al detalle de la cotización.
- La sección DEBE tener el encabezado "Por vencer" con un ícono de reloj.

**Prioridad**: Must have

#### REQ-WT-02: Negociaciones sin respuesta

**Descripción**: El sistema DEBE mostrar una sección con Negotiations en estado `counteroffer_made` (contraoferta emitida, esperando respuesta).

**Criterios de aceptación**:
- DEBE filtrar Negotiations con `status === 'counteroffer_made'`.
- DEBE mostrar máximo 3 items. Si hay más, DEBE indicar "y N más".
- Cada item DEBE mostrar lead/cliente y el monto de la última contraoferta.
- Cada item DEBE ser un enlace al detalle de la negociación.
- La sección DEBE tener el encabezado "Sin respuesta".

**Prioridad**: Must have

#### REQ-WT-03: Aprobaciones recientes

**Descripción**: El sistema DEBE mostrar una sección con Quotes que pasaron a `approved` en las últimas 24 horas.

**Criterios de aceptación**:
- DEBE filtrar Quotes con `status === 'approved'` y `updatedAt >= (now - 24h)`.
- DEBE mostrar máximo 3 items. Si hay más, DEBE indicar "y N más".
- Cada item DEBE mostrar cliente, monto y hora de aprobación.
- Cada item DEBE ser un enlace al detalle de la cotización.
- La sección DEBE tener el encabezado "Aprobaciones recientes".

**Prioridad**: Should have

---

### 1.3 Quick Actions (REQ-QA)

Barra horizontal con botones de acción inmediata.

#### REQ-QA-01: Botón "Nueva Cotización"

**Descripción**: El sistema DEBE mostrar un botón que navegue a `/quotes/new`.

**Criterios de aceptación**:
- El botón DEBE tener el label "Nueva Cotización".
- Al hacer clic, DEBE navegar a la ruta `/quotes/new` usando el router de Next.js.
- El botón DEBE mostrar un ícono de "+" o similar.

**Prioridad**: Must have

#### REQ-QA-02: Botón "Nueva Negociación"

**Descripción**: El sistema DEBE mostrar un botón que abra un drawer o navegue a la ruta de creación de negociaciones.

**Criterios de aceptación**:
- El botón DEBE tener el label "Nueva Negociación".
- Al hacer clic, DEBE abrir un modal/drawer con el formulario de creación O navegar a la ruta de creación.
- El botón DEBE mostrar un ícono de negociación.

**Prioridad**: Must have

#### REQ-QA-03: Botón "Ver Calendario"

**Descripción**: El sistema DEBE mostrar un botón placeholder que navegue a `/calendar`.

**Criterios de aceptación**:
- El botón DEBE tener el label "Ver Calendario".
- Al hacer clic, DEBE navegar a la ruta `/calendar`.
- El botón PUEDE estar deshabilitado con un tooltip "Próximamente" si la ruta no existe aún.

**Prioridad**: Nice to have

---

### 1.4 Filter Bar (REQ-FB)

Filtros compactos en una sola fila que se reflejan en la URL como query params.

#### REQ-FB-01: Filtro por estado

**Descripción**: El sistema DEBE proveer un dropdown multi-select con checkboxes para filtrar por estado de Quote y Negotiation.

**Criterios de aceptación**:
- DEBE listar todos los estados disponibles: `draft`, `sent`, `approved`, `rejected`, `expired`, `cancelled`, `open`, `counteroffer_made`, `accepted`.
- DEBE permitir seleccionar múltiples estados simultáneamente.
- Los estados seleccionados DEBEN reflejarse en la URL como `?status=draft,sent`.
- Si no hay selección, DEBEN mostrarse todos los documentos.

**Prioridad**: Must have

#### REQ-FB-02: Filtro por rango de fechas

**Descripción**: El sistema DEBE proveer inputs from/to para filtrar por `createdAt`.

**Criterios de aceptación**:
- DEBE mostrar dos inputs de tipo date: "Desde" y "Hasta".
- Los valores DEBEN reflejarse en la URL como `?dateFrom=2026-01-01&dateTo=2026-06-30`.
- Si solo se especifica "Desde", DEBE filtrar desde esa fecha en adelante.
- Si solo se especifica "Hasta", DEBE filtrar hasta esa fecha inclusive.

**Prioridad**: Should have

#### REQ-FB-03: Filtro por cliente

**Descripción**: El sistema DEBE proveer un select con búsqueda (autocomplete) para filtrar por cliente.

**Criterios de aceptación**:
- DEBE mostrar un input de búsqueda que filtre clientes del tenant mientras se escribe.
- Al seleccionar un cliente, DEBE filtrar la tabla por ese cliente.
- El cliente seleccionado DEBE reflejarse en la URL como `?clientId=<id>`.

**Prioridad**: Should have

#### REQ-FB-04: Filtro por asignado

**Descripción**: El sistema DEBE proveer un select con usuarios del tenant para filtrar por `createdBy`.

**Criterios de aceptación**:
- DEBE listar usuarios del tenant.
- Al seleccionar un usuario, DEBE filtrar la tabla por documentos cuyo `createdBy` coincida.
- El usuario seleccionado DEBE reflejarse en la URL como `?assignedTo=<userId>`.

**Prioridad**: Nice to have

---

### 1.5 Smart Table (REQ-ST)

Tabla unificada que muestra Quotes y Negotiations. Cada fila representa un documento cuyo tipo se distingue por un ícono sutil.

#### REQ-ST-01: Columna Cliente

**Descripción**: El sistema DEBE mostrar `companyName` + `contactName` del cliente asociado.

**Criterios de aceptación**:
- Para Quotes, DEBE obtener el nombre desde `Quote.clientId → Client.companyName`.
- Para Negotiations, DEBE obtener el nombre desde `Negotiation.leadId → Lead/Client.companyName`.
- DEBE mostrar "—" si no hay cliente asociado.

**Prioridad**: Must have

#### REQ-ST-02: Columna Tipo

**Descripción**: El sistema DEBE mostrar un ícono + label que distinga entre "Cotización" y "Negociación".

**Criterios de aceptación**:
- DEBE determinarse por `entityType` (`quote` vs `negotiation`).
- DEBE mostrar un ícono diferente para cada tipo.
- El label DEBE ser "Cotización" o "Negociación" respectivamente.
- NO DEBE usar color de fondo para diferenciar tipos.

**Prioridad**: Must have

#### REQ-ST-03: Columna Estado

**Descripción**: El sistema DEBE mostrar el label textual del status sin color, más un badge de expiración si aplica.

**Criterios de aceptación**:
- DEBE mostrar el label del status como texto plano (ej. "Enviada", "Aprobada", "Borrador").
- NO DEBE aplicar color al texto del status EXCEPTO por las reglas de REQ-CC.
- DEBE incluir el ExpiryBadge (REQ-EB) si la entidad tiene `validUntil` y el status no es `approved`/`accepted`.

**Prioridad**: Must have

#### REQ-ST-04: Columna Total

**Descripción**: El sistema DEBE mostrar el `total` formateado en CLP.

**Criterios de aceptación**:
- DEBE formatear usando `Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP' })`.
- Para Negotiations sin monto fijo, DEBE mostrar el monto de la última contraoferta o "—".
- DEBE alinear el texto a la derecha.

**Prioridad**: Must have

#### REQ-ST-05: Columna Vencimiento

**Descripción**: El sistema DEBE mostrar la fecha `validUntil` con countdown textual.

**Criterios de aceptación**:
- DEBE mostrar solo si `validUntil` existe.
- DEBE mostrar la fecha formateada en formato chileno (dd/mm/aaaa).
- DEBE incluir texto relativo: "Vence en N días" o "Vencida hace N días".
- Si no hay `validUntil`, DEBE mostrar "—".

**Prioridad**: Should have

#### REQ-ST-06: Columna Próxima Acción

**Descripción**: El sistema DEBE mostrar el texto de la siguiente acción sugerida según las reglas de negocio (REQ-NA).

**Criterios de aceptación**:
- DEBE calcularse usando la función pura `getNextAction(entity)`.
- DEBE mostrar el texto exacto definido en las reglas REQ-NA-01 a REQ-NA-07.
- Si ninguna regla aplica, DEBE mostrar "—".

**Prioridad**: Must have

#### REQ-ST-07: Columna Asignado

**Descripción**: El sistema DEBE mostrar avatar (iniciales) + nombre del usuario `createdBy`.

**Criterios de aceptación**:
- DEBE mostrar las iniciales del usuario en un círculo.
- DEBE mostrar el nombre completo del usuario.
- Si no hay usuario asignado, DEBE mostrar "—".
- DEBE usar `createdBy` como proxy de asignación hasta que exista un campo `assignedTo`.

**Prioridad**: Nice to have

---

### 1.6 Color Coding (REQ-CC)

Reglas estrictas de uso de color. Los colores se usan SOLO para señales de prioridad/urgencia.

#### REQ-CC-01: Rojo para badges expirados

**Descripción**: El sistema DEBE usar el color rojo (`#DC2626`) exclusivamente para badges de entidades expiradas.

**Criterios de aceptación**:
- El badge "Vencida" DEBE usar `#DC2626` como color de texto o fondo.
- Ningún otro elemento en la interfaz DEBE usar este color.
- El color SOLO aplica cuando `validUntil < today`.

**Prioridad**: Must have

#### REQ-CC-02: Naranja para badges por vencer

**Descripción**: El sistema DEBE usar el color naranja (`#EA580C`) exclusivamente para badges de entidades por vencer (≤7 días).

**Criterios de aceptación**:
- El badge "Por vencer" DEBE usar `#EA580C`.
- Aplica solo cuando `validUntil` está entre `today` y `today+7`.
- Ningún otro elemento DEBE usar este color.

**Prioridad**: Must have

#### REQ-CC-03: Verde para status approved/accepted

**Descripción**: El sistema DEBE usar el color verde (`#16A34A`) solo para el texto del status cuando es `approved` o `accepted`.

**Criterios de aceptación**:
- El label de status DEBE ser verde SOLO si `status === 'approved'` o `status === 'accepted'`.
- No DEBE usarse verde en badges de expiración, íconos de tipo, ni ningún otro elemento.

**Prioridad**: Must have

#### REQ-CC-04: Gris para status draft

**Descripción**: El sistema DEBE usar el color gris (`#6B7280`) solo para el texto del status cuando es `draft`.

**Criterios de aceptación**:
- El label de status DEBE ser gris SOLO si `status === 'draft'`.
- No DEBE usarse gris en ningún otro contexto de color.

**Prioridad**: Must have

#### REQ-CC-05: Sin color para todos los demás status

**Descripción**: El sistema NO DEBE aplicar color a los labels de status para estados no cubiertos por REQ-CC-03, REQ-CC-04.

**Criterios de aceptación**:
- Status `sent`, `rejected`, `cancelled`, `open`, `counteroffer_made`, `expired` DEBEN mostrarse como texto plano sin color.
- El badge rojo/naranja de expiración (REQ-EB) es independiente y no cuenta como color del status.
- No DEBE existir color coding inline para ningún status fuera de las reglas anteriores.

**Prioridad**: Must have

---

### 1.7 Expiry Badge (REQ-EB)

Componente que muestra el estado de expiración de una cotización o negociación.

#### REQ-EB-01: Badge "Vencida"

**Descripción**: El sistema DEBE mostrar un badge "Vencida" en rojo cuando `validUntil < today`.

**Criterios de aceptación**:
- DEBE mostrar el texto "Vencida".
- DEBE usar color `#DC2626`.
- Aplica incluso si el status no es `expired` (ej. un quote `sent` con fecha vencida).

**Prioridad**: Must have

#### REQ-EB-02: Badge "Por vencer"

**Descripción**: El sistema DEBE mostrar un badge "Por vencer" en naranja cuando `validUntil` está entre `today` y `today+7`.

**Criterios de aceptación**:
- DEBE mostrar el texto "Por vencer".
- DEBE usar color `#EA580C`.
- DEBE incluir la cantidad de días restantes (ej. "Por vencer en 3 días").

**Prioridad**: Must have

#### REQ-EB-03: Sin badge para fechas lejanas

**Descripción**: El sistema NO DEBE mostrar badge cuando `validUntil > today+7`.

**Criterios de aceptación**:
- Si `validUntil > today+7`, NO DEBE renderizarse ningún badge.
- La fecha de vencimiento aún DEBE mostrarse en la columna Vencimiento (REQ-ST-05).

**Prioridad**: Must have

#### REQ-EB-04: Sin badge para approved/accepted

**Descripción**: El sistema NO DEBE mostrar badge de expiración cuando el status es `approved` o `accepted`, incluso si tiene `validUntil`.

**Criterios de aceptación**:
- Si `status === 'approved'` o `status === 'accepted'`, NO DEBE renderizarse badge aunque `validUntil` esté vencido o por vencer.
- La lógica de expiración no aplica a entidades ya aprobadas/aceptadas.

**Prioridad**: Must have

#### REQ-EB-05: Sin badge sin validUntil

**Descripción**: El sistema NO DEBE mostrar badge cuando no existe `validUntil`.

**Criterios de aceptación**:
- Si `validUntil` es `null` o `undefined`, NO DEBE renderizarse ningún badge.
- La columna Vencimiento DEBE mostrar "—".

**Prioridad**: Must have

---

### 1.8 Next Action (REQ-NA)

Lógica de negocio para calcular la próxima acción sugerida para cada entidad.

#### REQ-NA-01: Draft → "Enviar cotización"

**Descripción**: El sistema DEBE sugerir "Enviar cotización" cuando el status de Quote es `draft`.

**Criterios de aceptación**:
- Si `entityType === 'quote'` y `status === 'draft'`, la acción DEBE ser "Enviar cotización".
- Esta regla tiene prioridad sobre cualquier otra.

**Prioridad**: Must have

#### REQ-NA-02: Sent sin cambios → "Dar seguimiento"

**Descripción**: El sistema DEBE sugerir "Dar seguimiento" cuando el Quote está `sent` y no hay Negotiation vinculada con contraoferta.

**Criterios de aceptación**:
- Si `entityType === 'quote'` y `status === 'sent'` y NO existe Negotiation vinculada con `quoteId === quote.id` y `status === 'counteroffer_made'`, la acción DEBE ser "Dar seguimiento".
- También aplica si existe Negotiation vinculada en status `open` (sin contraoferta aún).

**Prioridad**: Must have

#### REQ-NA-03: Sent con contraoferta → "Ir a negociación"

**Descripción**: El sistema DEBE sugerir "Ir a negociación" cuando el Quote está `sent` y existe Negotiation vinculada con contraoferta.

**Criterios de aceptación**:
- Si `entityType === 'quote'` y `status === 'sent'` y existe Negotiation con `quoteId === quote.id` y `status === 'counteroffer_made'`, la acción DEBE ser "Ir a negociación".
- El enlace DEBE navegar al detalle de la Negotiation vinculada.

**Prioridad**: Must have

#### REQ-NA-04: Approved → "Convertir a orden de trabajo"

**Descripción**: El sistema DEBE sugerir "Convertir a orden de trabajo" cuando el Quote está `approved`.

**Criterios de aceptación**:
- Si `entityType === 'quote'` y `status === 'approved'`, la acción DEBE ser "Convertir a orden de trabajo".

**Prioridad**: Must have

#### REQ-NA-05: Sent y por vencer → "Contactar cliente"

**Descripción**: El sistema DEBE sugerir "Contactar cliente" cuando el Quote está `sent` y `validUntil ≤ 7 days`.

**Criterios de aceptación**:
- Si `entityType === 'quote'` y `status === 'sent'` y `validUntil` existe y `validUntil <= today+7`, la acción DEBE ser "Contactar cliente".
- Esta regla tiene prioridad sobre REQ-NA-02 si ambas condiciones se cumplen.

**Prioridad**: Should have

#### REQ-NA-06: Expired → "Revisar y re-cotizar"

**Descripción**: El sistema DEBE sugerir "Revisar y re-cotizar" cuando el Quote está `expired`.

**Criterios de aceptación**:
- Si `entityType === 'quote'` y `status === 'expired'`, la acción DEBE ser "Revisar y re-cotizar".

**Prioridad**: Must have

#### REQ-NA-07: Counteroffer_made → "Responder contraoferta"

**Descripción**: El sistema DEBE sugerir "Responder contraoferta" cuando la Negotiation está en `counteroffer_made`.

**Criterios de aceptación**:
- Si `entityType === 'negotiation'` y `status === 'counteroffer_made'`, la acción DEBE ser "Responder contraoferta".
- Esta regla aplica a Negotiations, no a Quotes.

**Prioridad**: Must have

---

### 1.9 Detail Page (REQ-DP)

Rediseño de la página de detalle con layout de dos columnas, action bar persistente, version history y timeline.

#### REQ-DP-01: Layout de dos columnas

**Descripción**: El sistema DEBE mostrar el detalle en un layout de dos columnas: 60% información, 40% timeline.

**Criterios de aceptación**:
- Panel izquierdo (60%): DEBE mostrar título, estado, cliente, items, montos y términos.
- Panel derecho (40%): DEBE mostrar el timeline de actividad.
- En viewport menor a 1024px, las columnas DEBEN apilarse verticalmente.
- El layout DEBE ser responsivo sin romperse en tablet.

**Prioridad**: Must have

#### REQ-DP-02: Action Bar persistente

**Descripción**: El sistema DEBE mostrar una barra de acciones fijada al fondo (sticky bottom) con acciones disponibles según el estado actual.

**Criterios de aceptación**:
- Para Quotes: DEBE mostrar botones Enviar, Aprobar, Rechazar, Cancelar, Convertir a OT según el estado.
- Para Negotiations: DEBE mostrar botones Agregar contraoferta, Aceptar, Rechazar según el estado.
- Las acciones no disponibles DEBEN aparecer deshabilitadas con tooltip explicativo.
- La barra DEBE ser sticky al fondo de la ventana.
- DEBE ser visible en todo momento al hacer scroll.

**Prioridad**: Must have

#### REQ-DP-03: Version History integrado

**Descripción**: El sistema DEBE mostrar el historial de versiones como un acordeón colapsado por defecto dentro del panel izquierdo.

**Criterios de aceptación**:
- DEBE estar colapsado por defecto.
- Al expandirse, DEBE mostrar la lista de versiones con fecha, autor y monto.
- DEBE ubicarse debajo de la información principal, antes del timeline.

**Prioridad**: Should have

#### REQ-DP-04: Activity Timeline

**Descripción**: El sistema DEBE integrar el ActivityService existente para mostrar el historial completo de acciones sobre la entidad en el panel derecho.

**Criterios de aceptación**:
- DEBE obtener eventos desde `ActivityService` usando `entityType` y `entityId`.
- DEBE mostrar eventos en orden cronológico inverso (más reciente primero).
- DEBE mostrar fecha, usuario y descripción de cada evento.
- DEBE cubrir tanto acciones de Quote como de Negotiation.

**Prioridad**: Must have

#### REQ-DP-05: Navegación de retorno

**Descripción**: El sistema DEBE mostrar un enlace "← Volver a Centro Operativo" en la parte superior de la detail page.

**Criterios de aceptación**:
- DEBE mostrar el texto "← Volver a Centro Operativo".
- Al hacer clic, DEBE navegar a `/quotes`.
- DEBE estar visible sin necesidad de scroll.

**Prioridad**: Must have

---

### 1.10 Shared Types (REQ-TP)

Tipos compartidos de UI para garantizar consistencia entre componentes.

#### REQ-TP-01: QuoteTableRow

**Descripción**: El sistema DEBE definir una interfaz `QuoteTableRow` que represente cada fila de la smart table.

**Criterios de aceptación**:
- DEBE incluir campos de Quote y Negotiation según corresponda.
- DEBE incluir: `id`, `entityType`, `status`, `clientName`, `contactName`, `total`, `validUntil`, `createdBy`, `nextAction`, `expiryBadge`.
- DEBE ser un tipo union o discriminator para manejar ambos tipos de entidad.

**Prioridad**: Must have

#### REQ-TP-02: QuoteSummaryStats

**Descripción**: El sistema DEBE definir una interfaz `QuoteSummaryStats` para los 4 indicadores del executive summary.

**Criterios de aceptación**:
- DEBE incluir: `activeQuotes`, `pendingNegotiations`, `conversionRate`, `potentialValue`.
- Todos los campos DEBEN ser numéricos excepto `conversionRate` que PUEDE ser un string formateado.

**Prioridad**: Must have

#### REQ-TP-03: WorkTrayItem

**Descripción**: El sistema DEBE definir una interfaz `WorkTrayItem` para items de la bandeja de trabajo.

**Criterios de aceptación**:
- DEBE incluir: `id`, `entityType`, `title`, `subtitle`, `url`, `category`.
- `category` DEBE ser un tipo union: `'expiring' | 'awaiting_response' | 'recently_approved'`.

**Prioridad**: Must have

#### REQ-TP-04: NextAction

**Descripción**: El sistema DEBE definir un tipo `NextAction` como string union con los valores posibles de próxima acción.

**Criterios de aceptación**:
- DEBE incluir: `'send_quote' | 'follow_up' | 'go_to_negotiation' | 'convert_to_work_order' | 'contact_client' | 'review_and_requote' | 'respond_counteroffer' | 'none'`.
- DEBE incluir un label legible para cada valor.

**Prioridad**: Must have

#### REQ-TP-05: ExpiryBadge

**Descripción**: El sistema DEBE definir un tipo `ExpiryBadge` con la estructura `{ type: 'expired' | 'expiring' | 'none'; label: string; color: string }`.

**Criterios de aceptación**:
- `type` DEBE ser un string union limitado a los 3 valores.
- `label` DEBE ser el texto a mostrar ("Vencida", "Por vencer", o vacío).
- `color` DEBE ser el código hexadecimal del color correspondiente.
- `type === 'none'` DEBE tener `label: ''` y `color: 'transparent'`.

**Prioridad**: Must have

---

## 2. Scenarios

### SCEN-01: Usuario ve Executive Summary con conteos correctos

- **Given** hay 5 Quotes en estado `draft`, 3 Quotes en `sent`, 2 Quotes en `approved`, 1 Quote en `rejected`
- **And** hay 4 Negotiations en `open` y 2 en `counteroffer_made`
- **When** el usuario navega a la página `/quotes`
- **Then** el indicador "Cotizaciones activas" DEBE mostrar "8"
- **And** el indicador "Negociaciones pendientes" DEBE mostrar "6"
- **And** el indicador "Tasa de conversión" DEBE mostrar "33%"
- **And** el indicador "Valor potencial total" DEBE mostrar la suma de draft+ sent en CLP

### SCEN-02: Usuario ve Work Tray cuando hay cotizaciones por vencer

- **Given** hay 2 Quotes en estado `sent` con `validUntil` dentro de los próximos 7 días
- **And** hay 1 Negotiation en estado `counteroffer_made`
- **And** hay 1 Quote aprobado en las últimas 24 horas
- **When** el usuario navega a la página `/quotes`
- **Then** la sección "Por vencer" DEBE mostrar 2 items
- **And** la sección "Sin respuesta" DEBE mostrar 1 item
- **And** la sección "Aprobaciones recientes" DEBE mostrar 1 item

### SCEN-03: Usuario filtra smart table por estado

- **Given** la smart table muestra 20 Quotes y Negotiations de diversos estados
- **When** el usuario selecciona solo el estado `draft` en el filtro de estado
- **Then** la tabla DEBE mostrar solo las filas con `status === 'draft'`
- **And** la URL DEBE contener `?status=draft`

### SCEN-04: Usuario ve la próxima acción correcta para cada estado

- **Given** un Quote en estado `draft`
- **When** se renderiza la columna "Próxima Acción"
- **Then** DEBE mostrar "Enviar cotización"
- **Given** un Quote en estado `sent` sin negociación vinculada
- **When** se renderiza la columna "Próxima Acción"
- **Then** DEBE mostrar "Dar seguimiento"
- **Given** un Quote en estado `approved`
- **When** se renderiza la columna "Próxima Acción"
- **Then** DEBE mostrar "Convertir a orden de trabajo"

### SCEN-05: Usuario ve colores de expiry badge correctamente

- **Given** un Quote con `validUntil = yesterday`
- **When** se renderiza la fila en la smart table
- **Then** DEBE mostrar un badge "Vencida" con color `#DC2626`
- **Given** un Quote con `validUntil = today + 3`
- **When** se renderiza la fila en la smart table
- **Then** DEBE mostrar un badge "Por vencer" con color `#EA580C`
- **Given** un Quote con `validUntil = today + 30`
- **When** se renderiza la fila en la smart table
- **Then** NO DEBE mostrar ningún badge de expiración

### SCEN-06: Usuario hace clic en "Nueva Cotización"

- **Given** el usuario está en la página `/quotes`
- **When** hace clic en el botón "Nueva Cotización"
- **Then** el sistema DEBE navegar a `/quotes/new`

### SCEN-07: Usuario abre detalle con layout de dos columnas

- **Given** el usuario está viendo un Quote en `/quotes/[id]`
- **When** la página se renderiza
- **Then** DEBE mostrar un panel izquierdo con la información de la cotización
- **And** DEBE mostrar un panel derecho con el timeline de actividad
- **And** DEBE mostrar el enlace "← Volver a Centro Operativo" en la parte superior

### SCEN-08: Usuario ve action bar con acciones disponibles según estado

- **Given** un Quote en estado `sent`
- **When** el usuario abre la detail page
- **Then** la action bar DEBE mostrar los botones "Aprobar" y "Rechazar" habilitados
- **And** el botón "Enviar" DEBE aparecer deshabilitado con tooltip
- **Given** un Quote en estado `draft`
- **When** el usuario abre la detail page
- **Then** la action bar DEBE mostrar el botón "Enviar" habilitado

### SCEN-09: Usuario ve tabla unificada con Quotes y Negotiations

- **Given** hay Quotes y Negotiations en la base de datos
- **When** el usuario navega a `/quotes`
- **Then** la smart table DEBE mostrar ambos tipos de documentos en la misma vista
- **And** cada fila DEBE tener un ícono que distinga el tipo
- **And** las columnas DEBEN ser las mismas para ambos tipos

### SCEN-10: Comportamiento responsivo en tablet

- **Given** el viewport tiene un ancho de 900px
- **When** el usuario navega a `/quotes`
- **Then** el Executive Summary DEBE mostrarse en un grid 2x2
- **And** la Work Tray DEBE mostrar máximo 1 item por categoría
- **And** la tabla DEBE ocultar las columnas "Vencimiento" y "Asignado"
- **And** el layout NO DEBE romperse ni mostrar scroll horizontal

---

## 3. Non-functional Requirements

### NFR-01: Rendimiento

**Descripción**: La smart table DEBE manejar 100+ filas sin lag visible.

**Criterios de aceptación**:
- La tabla DEBE renderizar 100 filas en menos de 500ms en un dispositivo de referencia.
- El scroll DEBE ser suave sin saltos ni congelamiento.
- Los filtros DEBEN aplicar en menos de 200ms.
- Se DEBE considerar virtualización si el volumen supera 200 filas.

**Prioridad**: Must have

### NFR-02: Accesibilidad

**Descripción**: El color NO DEBE ser el único indicador visual de estado o prioridad.

**Criterios de aceptación**:
- Todos los estados DEBEN tener un label textual además del color.
- Los badges de expiración DEBEN incluir texto descriptivo ("Vencida", "Por vencer").
- Los elementos interactivos DEBEN ser accesibles por teclado.
- El contraste de color DEBE cumplir con WCAG AA mínimo.

**Prioridad**: Must have

### NFR-03: Mantenibilidad

**Descripción**: La lógica de próxima acción DEBE ser una función pura y fácil de unit testear.

**Criterios de aceptación**:
- `getNextAction(entity)` DEBE ser una función pura sin efectos secundarios.
- DEBE recibir un objeto con `entityType`, `status`, `validUntil`, y `hasNegotiationWithCounteroffer`.
- DEBE retornar un valor del tipo `NextAction`.
- DEBE tener tests unitarios que cubran todas las reglas REQ-NA-01 a REQ-NA-07.

**Prioridad**: Must have

### NFR-04: Compatibilidad

**Descripción**: El layout DEBE funcionar correctamente en navegadores modernos (Chrome, Firefox, Safari, Edge).

**Criterios de aceptación**:
- `Intl.NumberFormat` DEBE usarse con polyfill si es necesario para Safari < 14.
- CSS Grid y Flexbox DEBEN usarse para el layout responsivo.
- No DEBE requerir JavaScript deshabilitado para mostrar contenido estático.

**Prioridad**: Should have

---

## 4. Dependencias

| Dependencia | Tipo | Detalle |
|-------------|------|---------|
| `ActivityService.create()` | Servicio existente | Usado para el timeline en detail page |
| `Quote.clientId → Client` | Relación existente | Usado para columna Cliente en smart table |
| `Negotiation.leadId → Lead/Client` | Relación existente | Usado para columna Cliente en smart table |
| `Negotiation.quoteId` | Campo existente | Usado para detectar vinculación Quote→Negotiation |
| State machine de Quote | Lógica existente | Usado para determinar acciones disponibles en action bar |
| State machine de Negotiation | Lógica existente | Usado para determinar acciones disponibles en action bar |
| `createQuote` route | Ruta existente | `/quotes/new` — navegación desde Quick Actions |
| Filtros vía query params | Mecanismo existente | Los filtros se reflejan en URL query params |

---

## 5. Archivos Afectados

| Archivo | Cambio |
|---------|--------|
| `src/quotes/types/client-quote-types.ts` | CREAR — tipos compartidos de UI |
| `src/app/(dashboard)/quotes/page.tsx` | REESCRIBIR — nuevo layout con 5 zonas |
| `src/app/(dashboard)/quotes/[id]/page.tsx` | REESCRIBIR — layout 2 columnas + action bar |
| `src/components/quotes/executive-summary.tsx` | CREAR — barra de indicadores |
| `src/components/quotes/work-tray.tsx` | CREAR — bandeja de trabajo |
| `src/components/quotes/quick-actions.tsx` | CREAR — barra de acciones rápidas |
| `src/components/quotes/smart-table.tsx` | CREAR — tabla unificada |
| `src/components/quotes/smart-table-row.tsx` | CREAR — fila individual |
| `src/components/quotes/next-action-badge.tsx` | CREAR — componente de próxima acción |
| `src/components/quotes/expiry-badge.tsx` | CREAR — badge de expiración |
| `src/components/quotes/filter-bar.tsx` | CREAR — barra de filtros |
| `src/components/quotes/activity-timeline.tsx` | CREAR — timeline de actividad |
| `src/components/quotes/detail-info-panel.tsx` | CREAR — panel izquierdo del detalle |
| `src/components/quotes/detail-action-bar.tsx` | CREAR — barra de acciones persistente |
| `src/components/quotes/version-history.tsx` | CREAR — acordeón de versiones |
| `src/components/quotes/index.ts` | CREAR — barrel export |
