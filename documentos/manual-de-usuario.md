# Manual de Usuario — CRM 2026

Sistema de gestion para empresas de climatizacion y servicios de terreno.

---

## 1. Introduccion

**CRM 2026** es una plataforma web disenada para ayudar a empresas de climatizacion (HVAC) y servicios de terreno a gestionar todo el ciclo de vida de sus clientes: desde que una persona muestra interes hasta que recibe mantenciones periodicas.

### A quien esta dirigido

- **Dueno o gerente** — necesita una vision completa del negocio en tiempo real
- **Supervisor** — coordina tecnicos, ordenes y cumplimiento de plazos
- **Equipo comercial** — gestiona leads, cotizaciones y cierre de ventas
- **Tecnico de terreno** — recibe ordenes asignadas y reporta su trabajo

### Que problemas resuelve

- Centraliza la informacion de clientes, equipos y ordenes en un solo lugar
- Permite hacer seguimiento a las ordenes de trabajo desde que se crean hasta que se cierran
- Mide el cumplimiento de plazos (SLA) para asegurar respuestas oportunas
- Da visibilidad del pipeline comercial: cuantos leads hay, en que etapa estan y cuantas cotizaciones se aprueban
- Muestra la carga de trabajo de cada tecnico para evitar sobrecarga

---

## 2. Acceso y Navegacion

### Ingreso al sistema

1. Abra su navegador web (Chrome, Edge, Firefox, Safari)
2. Ingrese la direccion del sistema:
   - Durante la implementacion: `http://localhost:3000`
   - En produccion: la direccion que su empresa le haya proporcionado (ej: `https://crm.suempresa.cl`)

### La barra lateral (sidebar)

Al ingresar, vera una barra de navegacion en el lado izquierdo de la pantalla con las siguientes opciones:

- **Resumen** — vision ejecutiva del negocio
- **Operaciones** — ordenes de trabajo, tecnicos y SLA (supervisores)
- **Comercial** — leads, cotizaciones y clientes (equipo de ventas)
- **Tecnicos** — ordenes asignadas a mi (tecnicos en terreno)
- **Admin** — panel completo con todos los indicadores (solo dueno/gerente)

Cada usuario ve unicamente las secciones que corresponden a su rol. Si es tecnico, vera "Tecnicos" pero no "Admin".

### Navegacion en dispositivos moviles

En un telefono o tablet la barra lateral esta oculta inicialmente:

1. Toque el **boton circular** que aparece en la esquina inferior derecha (color destacado)
2. Se desplegara la barra de navegacion
3. Toque la opcion a la que quiere ir
4. Para cerrar, toque nuevamente el boton o la zona oscura detras del menu

Tambien puede deslizar el dedo desde el borde izquierdo de la pantalla para abrir la barra.

### Selector de fechas (DateRangePicker)

En la parte superior de cada panel hay un boton que dice "Filtrar por fecha" o "Fechas" (en movil). Sirve para ver los datos de un periodo especifico:

1. Toque el boton
2. Seleccione la fecha de inicio ("Desde") y la fecha de termino ("Hasta")
3. Los datos del panel se actualizaran automaticamente
4. Para volver a ver todo, toque "Limpiar filtros"

### Encabezado de pagina

La parte superior de cada pantalla muestra:

- El nombre de la seccion donde se encuentra
- Una breve descripcion de lo que contiene
- El selector de fechas

---

## 3. Panel de Administracion (dueno/gerente)

Ruta: `/dashboard/admin`

Este panel esta disenado para el dueno o gerente general. Muestra todos los indicadores del negocio en una sola pantalla.

### Resumen General

Seis tarjetas que muestran el pulso del negocio en tiempo real:

| Indicador | Que significa |
|-----------|---------------|
| **Clientes** | Total de clientes registrados. Muestra cuantos son nuevos este mes. |
| **Ordenes Pendientes** | Ordenes de trabajo aun no completadas. Muestra cuantas estan en progreso. |
| **Leads Nuevos** | Prospectos que han llegado en el periodo actual. |
| **Contratos Activos** | Contratos de mantencion vigentes. |
| **Empleados** | Total de empleados en el sistema. Muestra cuantos estan activos. |
| **Pipeline Total** | Valor estimado de todas las cotizaciones abiertas. |

### Operaciones

Cuatro metricas para monitorear el trabajo diario:

- **Completadas Hoy** — ordenes terminadas en el dia
- **En Progreso** — ordenes que se estan ejecutando ahora
- **Pendientes** — ordenes aun no iniciadas
- **Proximos 7 dias** — ordenes agendadas para la semana

### Cumplimiento SLA (Acuerdo de Nivel de Servicio)

El SLA mide que porcentaje de las ordenes se completan dentro del plazo acordado (48 horas). Una barra de color muestra el nivel de cumplimiento:

- **Verde (85% o mas)**: buen rendimiento, el equipo esta respondiendo a tiempo
- **Amarillo (70% - 84%)**: necesita atencion, hay ordenes que estan demorando mas de la cuenta
- **Rojo (menos de 70%)**: alerta, muchas ordenes se estan retrasando

Debajo de la barra se muestran los numeros concretos: ordenes a tiempo, ordenes retrasadas y tiempo promedio de respuesta.

### Carga de Tecnicos

Cada tecnico aparece con una barra que muestra cuantas ordenes tiene asignadas:

- **Verde (menos de 3)**: carga normal, el tecnico tiene disponibilidad
- **Amarillo (3 a 5)**: carga moderada, hay que monitorear
- **Rojo (mas de 5)**: sobrecarga, el tecnico tiene demasiadas ordenes y conviene redistribuir

### Pipeline Comercial

**Leads por Etapa**: muestra la distribucion de los leads segun su etapa en el proceso de ventas. Cada barra representa una etapa y su porcentaje sobre el total. Idealmente, la mayoria de los leads deberia avanzar hacia etapas avanzadas.

**Cotizaciones por Estado**: las cotizaciones se clasifican en:

| Estado | Color | Que significa |
|--------|-------|---------------|
| Borrador | Gris | Se esta preparando, aun no se envia al cliente |
| Enviada | Celeste | El cliente ya la recibio y esta evaluando |
| Aprobada | Verde | El cliente acepto la cotizacion |
| Rechazada | Rojo | El cliente no la acepto |

### Top Clientes por Facturacion

Ranking de los clientes que mas volumen de cotizacion han generado. Los primeros 3 aparecen destacados con medallas. Sirve para identificar rapidamente a los clientes mas valiosos del negocio.

### Contratos y Equipos

- **Contratos Activos** — mantenciones vigentes
- **Proximos a Vencer** — contratos que expiran en los proximos 30 dias
- **Mantenciones Proximas** — visitas de mantenimiento agendadas
- **Equipos en Contrato** — total de equipos cubiertos por contratos activos

---

## 4. Panel del Supervisor

Ruta: `/dashboard/supervisor`

El panel del supervisor esta enfocado en la operacion del dia a dia: ordenes, tecnicos y cumplimiento.

### Estado del Dia

Cuatro indicadores que resumen la jornada:

- **Ordenes Pendientes** — lo que aun no se ha iniciado
- **En Progreso** — lo que los tecnicos estan ejecutando ahora
- **Completadas Hoy** — lo que ya se termino
- **Proximos 7 dias** — lo que viene en la semana

### Cumplimiento SLA

Similar al panel de administracion, pero con un desglose mas detallado:

- Total de ordenes **a tiempo** versus **retrasadas**
- **Horas promedio de respuesta** — cuanto se tarda en atender una orden desde que se crea
- **Completadas este mes** — ordenes terminadas en el periodo

La barra de efectividad sigue el mismo codigo de colores: verde (>85%), amarillo (70-84%), rojo (<70%).

### Carga de Tecnicos

Lista de tecnicos con el numero de ordenes asignadas a cada uno. Una barra de progreso indica visualmente la carga:

- Una barra **verde** significa que el tecnico tiene pocas ordenes
- **Amarilla** indica carga moderada
- **Roja** senala sobrecarga

Como supervisor, usted puede reasignar ordenes de un tecnico con carga roja a uno con carga verde para equilibrar el trabajo.

### Contratos Proximos a Vencer

Muestra los contratos que estan por expirar en los proximos 30 dias. Si hay contratos por vencer, aparecera un aviso destacado para coordinar renovaciones. Tambien se muestran las mantenciones proximas y los equipos bajo contrato.

---

## 5. Panel Comercial

Ruta: `/dashboard/commercial`

Este panel esta disenado para el equipo de ventas. Su objetivo es dar visibilidad del pipeline y ayudar a priorizar las acciones comerciales.

### Snapshot Comercial

Seis tarjetas con las metricas principales:

| Indicador | Que significa |
|-----------|---------------|
| **Leads Activos** | Total de prospectos en seguimiento actualmente |
| **Nuevos este Mes** | Cuantos leads han entrado en el periodo actual |
| **Convertidos** | Cuantos leads se transformaron en clientes este mes |
| **Tasa Conversion** | Porcentaje de leads que se convierten en clientes. Si es menor a 25%, aparece como baja. |
| **Pipeline Total** | Valor estimado de todas las cotizaciones activas |
| **Clientes** | Total de clientes registrados |

### Leads por Etapa

Cada etapa del proceso de ventas se muestra con su cantidad de leads y el porcentaje que representa:

| Etapa | Que significa |
|-------|---------------|
| **Nuevo** | Lead recien ingresado, sin contacto |
| **Contactado** | Ya se establecio comunicacion |
| **Calificado** | Se confirmo que tiene necesidad y presupuesto |
| **Ganado** | Se convirtio en cliente |
| **Perdido** | No se concreto la venta |

Las barras usan colores para indicar el estado: verde para ganados, rojo para perdidos, color destacado para calificados.

### Cotizaciones

Distribucion de cotizaciones por estado:

- **Borrador** — en preparacion
- **Enviadas** — el cliente las tiene
- **Aprobadas** — aceptadas (verde)
- **Rechazadas** — no aceptadas (rojo)

**Tasa de Aprobacion**: indica que porcentaje de las cotizaciones enviadas son aprobadas. Una tasa sobre 60% se considera buena (verde), entre 30% y 60% es regular (amarillo), bajo 30% es baja (rojo).

### Top Clientes por Facturacion

Tabla con los clientes que mas volumen de cotizacion han generado, ordenados de mayor a menor. Incluye el monto total cotizado para cada uno.

### Contratos y Renovaciones

Muestra los contratos activos, los que estan por vencer (oportunidad de renovacion), las mantenciones proximas y los equipos en contrato. Sirve para que el equipo comercial identifique clientes con los que se puede iniciar una conversacion de renovacion o venta adicional.

---

## 6. Panel del Tecnico

Ruta: `/dashboard/technician`

Este panel muestra la informacion personal del tecnico: que ordenes tiene asignadas, su carga de trabajo y su rendimiento.

### Resumen del Dia

Al ingresar, el sistema saluda al tecnico por su nombre y muestra tres indicadores:

- **Ordenes Asignadas** — cuantas ordenes tiene pendientes
- **Completadas Hoy** — cuantas termino en el dia
- **Proximos 7 dias** — ordenes agendadas para los siguientes 7 dias

### Mi Carga de Trabajo

Una barra de progreso que muestra el nivel de ocupacion actual:

- **Verde**: carga baja, hay disponibilidad para mas ordenes
- **Amarillo**: carga moderada, rendimiento estable
- **Rojo**: carga alta, se recomienda priorizar tareas criticas

### Mi Rendimiento SLA

Mide el cumplimiento de plazos del tecnico. Incluye:

- **Porcentaje de efectividad** con la misma escala de colores del SLA
- **Ordenes a tiempo** — las que completo dentro del plazo
- **Ordenes retrasadas** — las que se demoraron mas de lo acordado

### Ordenes en Progreso

Tres tarjetas que resumen el estado actual de las ordenes:

- **En progreso** — las que esta ejecutando ahora
- **Completadas hoy** — las que ya termino
- **Pendientes** — las que aun no inicia

### Mantenciones Programadas

Muestra las mantenciones agendadas para los proximos 30 dias, los equipos que tiene a cargo y los contratos activos relacionados.

---

## 7. Ciclo de Vida del Cliente

El sistema organiza la relacion con cada cliente en una secuencia de etapas. Comprender este flujo ayuda a usar mejor la plataforma.

```
  LEAD (prospecto)
    |  Llega por WhatsApp, llamada, formulario web o referral
    |  Se contacta, se califica
    v
  CLIENTE
    |  Se registra con datos de contacto, direccion y tipo
    |  (residencial, comercial o industrial)
    v
  COTIZACION
    |  Se prepara con servicios, equipos y valores
    |  Se envia al cliente para aprobacion
    |  Puede tener multiples versiones
    v
  CONTRATO DE MANTENCION
    |  Aprobada la cotizacion, se firma un contrato
    |  Define frecuencia de mantencion (mensual, trimestral, etc.)
    |  Incluye los equipos cubiertos
    v
  ORDENES DE TRABAJO
    |  El contrato genera ordenes periodicas
    |  Se asignan a tecnicos segun disponibilidad
    |  Siguen un ciclo de estados hasta completarse
    v
  EJECUCION Y REPORTE
    |  El tecnico ejecuta la visita
    |  Completa lista de verificacion previa
    |  Reporta trabajo realizado, observaciones y recomendaciones
    |  El cliente firma conforme
```

### Explicacion paso a paso

**Paso 1: El lead llega**

Una persona necesita servicios de climatizacion. Puede llegar por varios canales: llamada telefonica, mensaje de WhatsApp, formulario en la pagina web, recomendacion de otro cliente, o visita directa a la oficina. Alguien del equipo registra este prospecto como un **Lead** en el sistema, indicando su nombre, telefono, origen y una breve nota.

**Paso 2: Se califica y convierte en cliente**

El equipo comercial contacta al lead, evalua sus necesidades y confirma que es un prospecto valido. Si todo esta bien, el lead se convierte en **Cliente**. Queda registrado con su tipo (residencial, comercial o industrial), direccion y datos de contacto.

**Paso 3: Se genera una cotizacion**

Con el cliente registrado, el equipo prepara una **Cotizacion** formal con los servicios requeridos, equipos, valores y condiciones. La cotizacion puede tener varias versiones si se hacen ajustes. Se envia al cliente para su revision.

**Paso 4: Se aprueba y firma contrato**

Cuando el cliente acepta la cotizacion, se crea un **Contrato de Mantencion** que define:

- La duracion del servicio
- La frecuencia de las visitas (mensual, bimensual, trimestral, semestral o anual)
- Los equipos cubiertos
- Las fechas de inicio y termino

**Paso 5: El contrato genera ordenes de trabajo**

El sistema crea automaticamente **Ordenes de Trabajo** segun la frecuencia del contrato. Por ejemplo, si es un contrato mensual, cada mes se genera una orden para realizar la mantencion.

**Paso 6: Tecnicos ejecutan y reportan**

Cada orden de trabajo pasa por los siguientes estados:

```
Borrador -> Programada -> Confirmada -> Asignada
  -> En Ruta -> En Sitio -> Completada -> Cerrada
```

En cualquier momento puede ser **Pausada** o **Cancelada**.

El tecnico:

1. Revisa la orden y prepara herramientas y repuestos
2. Confirma su ruta de visita
3. Llega al domicilio y registra su llegada
4. Ejecuta el trabajo
5. Completa el reporte de visita con el detalle de lo realizado
6. Registra observaciones y recomendaciones
7. Obtiene la firma del cliente como conformidad

### Resumen en una linea

**Lead se contacta -> se convierte en Cliente -> recibe Cotizacion -> firma Contrato -> recibe Ordenes de Trabajo periodicas -> Tecnico ejecuta y reporta.**

---

## 8. Preguntas Frecuentes

### 1. No veo todas las secciones del menu. Me faltan opciones.

Cada usuario tiene acceso solo a las secciones que corresponden a su rol. Si necesita acceder a una seccion que no ve, consulte con su administrador para que revise sus permisos. Por ejemplo, solo el dueno y el administrador ven el panel "Admin".

### 2. Que significa cada color en las barras de progreso?

El sistema usa un codigo de colores consistente:

- **Verde**: situacion buena o bajo control (SLA sobre 85%, carga baja de trabajo, cotizaciones aprobadas)
- **Amarillo**: atencion moderada, hay que monitorear (SLA entre 70% y 84%, carga media)
- **Rojo**: alerta, requiere accion (SLA bajo 70%, sobrecarga de tecnicos, cotizaciones rechazadas)

### 3. Como se calcula el SLA?

El SLA (Acuerdo de Nivel de Servicio) mide cuantas ordenes se completan dentro de las 48 horas desde que se crean. El porcentaje se calcula como: ordenes completadas a tiempo dividido por el total de ordenes completadas (a tiempo + retrasadas). El objetivo minimo es 85%.

### 4. Un tecnico tiene muchas ordenes asignadas. Que hago?

En el panel de Supervisor, la seccion "Carga de Tecnicos" muestra quienes tienen sobrecarga (barra roja, mas de 5 ordenes). Como supervisor, puede reasignar ordenes desde un tecnico con carga roja a uno con carga verde (menos de 3 ordenes) para equilibrar la distribucion del trabajo.

### 5. Que diferencia hay entre un lead y un cliente?

Un **Lead** es un prospecto que ha mostrado interes pero aun no ha contratado servicios. Un **Cliente** es un lead que fue calificado y convertido, y que ya puede recibir cotizaciones y contratos. La conversion de lead a cliente ocurre cuando se confirma que es un prospecto valido y se completan sus datos.

### 6. Como se genera una orden de trabajo desde un contrato?

Cuando se crea un contrato de mantencion con una frecuencia definida (ej: mensual), el sistema genera automaticamente las ordenes de trabajo para cada periodo. No es necesario crearlas manualmente. Las ordenes aparecen en el panel del supervisor con estado "Programada" y desde ahi se asignan a los tecnicos.

### 7. Que informacion debo registrar como tecnico al completar una visita?

Al completar una orden de trabajo debe registrar:

- Hora de llegada y hora de salida
- Trabajo realizado (descripcion detallada)
- Observaciones relevantes (ej: estado del equipo, condiciones del lugar)
- Recomendaciones para el cliente (ej: proxima mantencion, repuestos necesarios)
- Firma del cliente como conformidad

### 8. Puedo ver datos de periodos anteriores?

Si. Use el selector de fechas que aparece en la parte superior de cada panel (boton "Filtrar por fecha" o "Fechas" en movil). Seleccione la fecha de inicio y termino del periodo que quiere consultar. Los indicadores se actualizaran para mostrar solo los datos de ese rango. Para volver a la vista completa, toque "Limpiar filtros".

---

*Documentacion para usuarios de CRM 2026 — Plataforma de gestion para empresas de climatizacion y servicios de terreno.*
