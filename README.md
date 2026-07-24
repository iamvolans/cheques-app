# GC · Gestión de Cobranza de Cheques y E-Cheqs

Plataforma web integral para la **gestión profesional de cobranza de cheques físicos y electrónicos (e-cheqs)**, orientada a Proveedores de Servicios de Pago (PSPCP), mesas de dinero reguladas y empresas de cobranza que administran valores de terceros.

Cubre el ciclo completo: carga y custodia de valores, seguimiento de estados, liquidación a clientes, portal de autogestión para el cliente final, analítica de riesgo y monitoreo transaccional PLAFT — con trazabilidad y auditoría en cada operación.

---

## Módulos y funcionalidades

### Operación
- Carga de cheques físicos y e-cheqs con validaciones (CUIT, CP de sucursal bancaria obligatorio, catálogo cerrado de bancos del circuito argentino con búsqueda).
- Cálculo automático de **plaza** (cámara/interior según CP) y **comisión por cliente** con tarifas diferenciadas por plaza.
- Ciclo de estados: en custodia → aceptado → depositado → procesado / rechazado, con fechas de acreditación estimadas por días hábiles (feriados configurables).
- **Redepósito** de cheques rechazados (segunda presentación) con reversa contable automática.
- Calendario de custodias y proyección de flujo de caja (acreditaciones próximas a 30 días).
- Búsqueda avanzada: texto, cliente, estado, rango de fechas, rango de importe, tipo y plaza, con paginación con saltos y exportación XLS del filtro activo sin límite de filas.

### Clientes y liquidaciones
- Cuenta corriente por cliente reconstruible desde movimientos (acreditaciones, débitos por rechazo, liquidaciones, ajustes).
- Solicitudes de transferencia desde el portal + flujo de aprobación por operaciones.
- Extractos XLS con conceptos en columnas separadas (cheque, fee, multa, crédito/débito, saldo acumulado).
- Tendencia de volumen por cliente (sparkline 6 meses).

### Portal del cliente
- Acceso por link tokenizado + **PIN** (bcrypt) + **2FA TOTP opcional** activable por el cliente.
- Sesiones JWT firmadas (HS256) de 30 minutos en cookies httpOnly.
- Saldo disponible, valores en gestión, rechazos, costos y descarga de extracto.

### Analítica y riesgo
- **Scoring de riesgo de librador** (0-100) con ponderación bayesiana por volumen y recencia; lista negra con score máximo automático.
- Banner de riesgo del librador en el formulario de carga (consulta en vivo por CUIT).
- **Concentración de cartera** por cliente y por banco emisor con semáforo.
- Comparativos mes contra mes y alerta de rechazo en alza.

### Monitoreo PLAFT
- **Score PLAFT por cliente** (0-100) con cuatro señales: concentración de destino, destinos compartidos entre clientes, envíos a personas físicas y fraccionamiento.
- **Umbrales mensuales parametrizables** de acumulación por destino (persona física / jurídica).
- **Alerta preventiva en el punto de decisión**: al cargar o aprobar una liquidación, el sistema informa el acumulado mensual del destino contra el umbral, el cruce entre clientes y si el CUIT está bloqueado.
- Página de monitoreo con ranking, destinos compartidos y acumulados del mes.
- Lista de CUITs destino bloqueados.

### Back-office y auditoría
- Correcciones administrativas con doble factor (TOTP) en cada acción sensible: reasignación de cheques con recálculo de comisión, ajuste manual de saldo, edición de datos con recálculo de plaza/fee, anulación de movimientos.
- **Log de auditoría inmutable** con autor, acción, valores previos y posteriores.
- Historial de cambios por cliente.
- Roles operador / administrador con segregación de funciones (solo el administrador mueve fondos).

### Seguridad
- MFA TOTP **obligatorio** para todo el equipo (verificación AAL2 en cada página).
- Row Level Security (RLS) en la base de datos.
- Cifrado en tránsito (TLS vía Cloudflare/Vercel); credenciales del portal hasheadas.
- Costos bancarios por cuenta y reconocimiento prudente de ganancia (al resolverse el valor).

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16 (App Router, React Server Components, Server Actions) |
| Lenguaje | TypeScript (strict) |
| Base de datos | PostgreSQL vía Supabase (tablas, vistas, triggers y RLS versionados en `supabase/schema.sql`) |
| Autenticación | Supabase Auth + MFA TOTP · JWT (jose) para el portal |
| UI | Tailwind CSS v4 con tokens semánticos OKLCH · tema claro/oscuro |
| Gráficos | Recharts + SVG nativo |
| Documentos | SheetJS (XLSX) para exports |
| Integraciones | Google Drive (service account, fotos de cheques) · Gmail API (OAuth, notificaciones) |
| Infraestructura | Vercel (hosting + cron) · Cloudflare (DNS, TLS, rate limiting) |

## Arquitectura

```
Navegador ──► Cloudflare (TLS, WAF) ──► Vercel (Next.js)
                                          │  Server Actions / API Routes
                                          ▼
                                    Supabase (PostgreSQL)
                                    · Lógica contable en triggers
                                    · Vistas de analítica y PLAFT
                                    · RLS + Auth + MFA
                                          │
                        ┌─────────────────┴──────────────┐
                        ▼                                ▼
              Google Drive (fotos)              Gmail API (notificaciones)
```

Principio de diseño: **la lógica contable vive en la base de datos** (triggers que calculan comisiones y generan movimientos al cambiar estados), garantizando consistencia sin importar desde dónde se opere. Las server actions orquestan, validan permisos y auditan.

## Requisitos

- Node.js 20+
- Cuenta de Supabase (plan según volumen)
- Cuenta de Vercel
- (Opcional) Cloudflare para dominio propio
- (Opcional) Proyecto de Google Cloud para Drive/Gmail

## Inicio rápido (desarrollo)

```bash
git clone <repo>
cd cheques-app
npm install
cp .env.example .env.local   # completar credenciales (ver docs/INSTALACION.md)
npm run dev                   # http://localhost:3000
```

La base de datos se crea aplicando `supabase/schema.sql` sobre un proyecto de Supabase nuevo. El paso a paso completo para un despliegue productivo (cliente nuevo) está en **[docs/INSTALACION.md](docs/INSTALACION.md)**.

## Estructura del repositorio

```
app/            Rutas (App Router): páginas operativas, admin, portal y API
  (app)/        Aplicación interna (requiere sesión + MFA)
  portal/       Portal del cliente (token + PIN + 2FA)
  api/          Exports XLS, backups, notificaciones, cron
actions/        Server actions (lógica de negocio y validación de permisos)
components/     Componentes React por dominio (cheques, clientes, liquidaciones, admin, ui)
lib/            Clientes de Supabase, sesión del portal, integraciones Google
supabase/       schema.sql — esquema completo de la base (fuente de verdad instalable)
docs/           Documentación de instalación y arquitectura
```

## Documentación

- **[docs/INSTALACION.md](docs/INSTALACION.md)** — despliegue completo para un cliente nuevo (Supabase, Vercel, Cloudflare, Google, cron, primer admin).
- **[docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)** — guía para desarrolladores: modelo de datos, convenciones, dónde vive cada lógica.

## Licencia

Software propietario. Todos los derechos reservados. El uso requiere licencia comercial por instalación/cliente — ver [LICENSE](LICENSE). Contacto comercial: el titular del repositorio.
