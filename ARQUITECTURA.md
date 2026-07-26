# Arquitectura · Guía para desarrolladores

Documento de referencia para quien mantenga o extienda la plataforma.

## Principios de diseño

1. **La lógica contable vive en la base de datos.** Los triggers de PostgreSQL calculan la comisión al insertar un cheque y generan los movimientos de saldo al cambiar de estado. Esto garantiza consistencia sin importar el punto de entrada. El código TypeScript **no** duplica esa lógica en el flujo normal — solo en las herramientas de corrección administrativa, donde el recálculo es explícito y auditado.
2. **El saldo de un cliente no se guarda: se reconstruye.** Es la suma de sus `movimientos_clientes`. No hay campo `saldo` que pueda desincronizarse.
3. **Toda acción sensible queda en `logs_auditoria`** con autor, valores previos y posteriores.
4. **Segregación por roles**: `operador` opera el día a día; `administrador` mueve fondos y corrige, con reingreso de TOTP en las acciones de mayor riesgo.
5. **Server Components por defecto**; client components solo donde hay interacción. Las mutaciones van por **server actions** (`actions/*`), nunca fetch desde el cliente a la base.

## Modelo de datos (núcleo)

```
clientes ──< cheques >── cuentas_bancarias_empresa
    │            │
    │            └──< movimientos_clientes (acreditacion | debito_rechazo | liquidacion | ajuste_manual)
    │
    ├──< liquidaciones (transferencias a destinos: CBU, CUIT beneficiario)
    ├──< solicitudes_transferencia (pedidos desde el portal)
    └──  credenciales del portal (token, pin_hash, totp)

bancos                    catálogo cerrado de entidades (combobox de carga/edición)
lista_negra_libradores    CUITs de libradores vetados (score 100 automático)
cuits_destino_bloqueados  destinos vetados para liquidar
plaft_parametros          umbrales mensuales por tipo de persona (fila única id=1)
feriados                  para el cálculo de días hábiles
logs_auditoria            auditoría inmutable
notificaciones_pendientes cola de emails (procesada por cron)
```

### Triggers sobre `cheques` (ver `supabase/schema.sql`)
- `fn_cheques_before_insert`: calcula plaza por CP (≤2000 cámara, resto interior) y fee según tarifa del cliente (cámara / interior con fallback).
- `fn_cheques_before_update`: valida permisos por rol (rechazo/multa/gasto solo admin), impide depositar diferidos antes de fecha, setea `fecha_deposito` y `fecha_estimada_acred` (+2 días hábiles).
- `fn_cheques_after_update`: al pasar a `procesado` inserta la acreditación (`monto − fee`); al pasar a `rechazado` inserta el débito (`fee + multa`), revierte acreditación previa si venía de procesado, y encola el email.
- `fn_marcar_resolucion`: setea `fecha_resolucion` al resolverse (procesado/rechazado).

**Regla al desarrollar:** si una corrección administrativa cambia el fee o el cliente de un cheque ya resuelto, hay que ajustar el movimiento asociado a mano (patrón en `actions/correcciones.ts`: `reasignarCheque`, `editarDatosCheque`, `redepositarCheque`). El trigger no recalcula retroactivamente.

### Vistas de analítica
- `vw_ganancias`: ganancia por cliente/mes. Procesados: `fee − costo_bancario%`; rechazados: `fee + multa − gasto − costo_bancario%`.
- `vw_libradores_stats` / `vw_libradores_score`: agregado por CUIT librador y score 0-100 (encogimiento bayesiano + recencia + lista negra).
- `vw_exposicion_cliente` / `vw_exposicion_banco` / `vw_concentracion_resumen`: concentración de cartera en gestión.
- `vw_proyeccion_acreditaciones`: flujo proyectado 30 días.
- `vw_plaft_*`: liquidaciones normalizadas, destinos, cliente×destino, acumulado mensual y score PLAFT por cliente.

## Estructura del código

```
app/(app)/            páginas internas — TODAS verifican sesión + AAL2 (MFA) al inicio
app/portal/[token]/   portal del cliente — gate PIN + 2FA propio (lib/portal/sesion.ts)
app/api/              exports XLS (paginado interno de a 1000), cron, comprobantes
actions/
  cheques.ts          carga y cambio de estados (Zod valida la entrada)
  correcciones.ts     herramientas admin: exigirAdmin() / exigirAdminConTotp()
  plaft.ts            consulta de destino vs umbral + parámetros PLAFT
  configuracion.ts    cuentas, feriados, convenios, lista negra
components/           por dominio; ui/ contiene los reutilizables (InputCuit,
                      InputBanco combobox, Paginador, Sparkline, ExportarXls)
lib/supabase/         server.ts (cliente con sesión) · admin.ts (service role)
lib/portal/sesion.ts  JWT HS256 del portal, cookie httpOnly path "/"
```

### Cliente con sesión vs admin client
- `createClient()` (sesión): flujo normal. Los triggers ven `auth.uid()` y validan rol.
- `createAdminClient()` (service role): solo en server actions tras validar rol explícitamente. Necesario para operar sobre RLS, pero los triggers **no** ven al usuario — si un update debe pasar validaciones de rol del trigger, usar el cliente de sesión (patrón en `redepositarCheque`).

## Convenciones

- Idioma del código y UI: **español** (nombres de dominio del negocio).
- Estilos: tokens semánticos (`bg-card`, `text-danger`, `bg-warning-muted`...) definidos en `app/globals.css` (OKLCH, claro/oscuro). No usar colores literales de Tailwind en pantallas internas.
- Dinero: `numeric` en la base, `Number()` + `Intl.NumberFormat("es-AR")` en UI. Redondeo a 2 decimales con `Math.round(x*100)/100` consistente con `round(x,2)` de SQL.
- CUIT/CBU: normalizar a dígitos (`replace(/\D/g,"")`) antes de comparar.
- Validación de entrada con Zod v4 (sintaxis `{ error: "..." }`).
- Exports XLS: SheetJS, paginado interno de a 1000 filas (límite por query de Supabase).

## Puntos de extensión típicos

- **Nuevo reporte/analítica**: crear vista SQL → página server component → (opcional) card en dashboard. Patrón: `/riesgo`, `/plaft`.
- **Nueva herramienta de corrección**: server action en `correcciones.ts` con `exigirAdminConTotp`, ajuste de movimientos si el cheque está resuelto, log de auditoría, componente en `components/admin/`.
- **Nueva señal PLAFT**: sumarla como CTE en `vw_plaft_score_cliente` con su peso, documentar el umbral.

## Deuda técnica conocida

- La fórmula de fee (plaza → % → cálculo) existe en 4 lugares: trigger `before_insert`, `reaplicarTarifaCliente`, `editarDatosCheque` y `reasignarCheque`. Si cambia la fórmula, actualizar los cuatro (candidato a función SQL única).
- La señal PLAFT de envíos a personas físicas usa umbral absoluto (satura en clientes grandes); pendiente pasarla a % del volumen con piso de monto.
- Señales PLAFT de velocidad y pass-through: diseñadas, no implementadas.
