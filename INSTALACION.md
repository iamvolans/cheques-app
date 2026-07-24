# Guía de instalación · Despliegue para un cliente nuevo

Esta guía cubre el despliegue productivo completo de una instancia nueva de la plataforma. Tiempo estimado: 2 a 4 horas la primera vez.

**Índice:** 1. Supabase · 2. Variables de entorno · 3. Vercel · 4. Dominio y Cloudflare · 5. Google (Drive y Gmail) · 6. Cron jobs · 7. Primer usuario administrador · 8. Configuración inicial de negocio · 9. Checklist final

---

## 1. Base de datos (Supabase)

1. Crear un proyecto nuevo en [supabase.com](https://supabase.com) (región `sa-east-1` para Argentina). Guardar la contraseña de la base.
2. Aplicar el esquema completo. Desde la raíz del repo:

   ```bash
   psql "postgresql://postgres.REF:PASSWORD@HOST:5432/postgres" -f supabase/schema.sql
   ```

   Alternativa sin psql: pegar el contenido de `supabase/schema.sql` en el SQL Editor del dashboard y ejecutarlo.

3. Verificar que se crearon las piezas principales:

   ```sql
   select count(*) from information_schema.tables where table_schema = 'public';   -- tablas
   select count(*) from information_schema.views  where table_schema = 'public';   -- vistas
   ```

4. **Habilitar MFA (TOTP)** en Authentication → Settings → Multi-Factor.
5. En Authentication → Providers dejar solo **Email** (la app no usa OAuth social).
6. Cargar el catálogo de bancos si el schema no incluye datos: ver `supabase/schema.sql` sección `bancos` (o solicitar el seed de bancos del circuito argentino).

## 2. Variables de entorno

Copiar `.env.example` y completar **todas** las variables. Referencia rápida:

| Variable | Origen |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` / `SERVICE_ROLE_KEY` | Supabase → Settings → API |
| `NEXT_PUBLIC_APP_URL` | dominio productivo (`https://www.cliente.com`) |
| `PORTAL_SESSION_SECRET` | `openssl rand -hex 32` |
| `CRON_SECRET` | `openssl rand -hex 16` |
| `GOOGLE_*` | ver sección 5 |
| `GMAIL_*` | ver sección 5 |

Seguridad: la `SERVICE_ROLE_KEY` da acceso total a la base. Solo en variables de servidor (nunca `NEXT_PUBLIC_`), nunca en el repo.

## 3. Vercel

1. Importar el repositorio en Vercel (framework: Next.js, valores por defecto).
2. Cargar **todas** las variables de entorno (Production).
3. Deploy. Verificar que el build termina verde y la URL `*.vercel.app` carga la pantalla de login.

## 4. Dominio y Cloudflare (recomendado)

1. Delegar el dominio del cliente a Cloudflare (plan Free alcanza).
2. En Vercel → Settings → Domains, agregar `www.cliente.com` (canónico) y `cliente.com` (redirect).
3. En Cloudflare, crear los CNAME que indique Vercel, con proxy activado (nube naranja).
4. SSL/TLS en modo **Full (strict)**.
5. (Recomendado) Regla de rate limiting sobre `/api/*`, `/portal/*` y `/login` — por ejemplo, 50 requests / 10 s por IP, acción block. Ajustar el umbral si la operatoria legítima lo dispara.
6. Actualizar `NEXT_PUBLIC_APP_URL` al dominio final y redeployar.

## 5. Google Cloud (Drive y Gmail)

Un proyecto de Google Cloud por cliente (aislamiento) o uno común con carpetas separadas — decisión comercial.

### Drive (fotos de cheques) — Service Account
1. Google Cloud → habilitar **Google Drive API**.
2. IAM → Service Accounts → crear (`drive-cheques@...`), generar **key JSON**.
3. Del JSON: `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`; `private_key` → `GOOGLE_PRIVATE_KEY` (con `\n` literales).
4. Crear la carpeta raíz en el Drive del cliente y **compartirla con el email de la service account** (Editor). El ID de la carpeta (en la URL) → `GOOGLE_DRIVE_ROOT_FOLDER_ID`.

### Gmail (notificaciones) — OAuth
1. Habilitar **Gmail API**.
2. Credentials → OAuth Client ID (tipo Web). Guardar `CLIENT_ID` y `CLIENT_SECRET`.
3. Obtener un **refresh token** de la casilla emisora con scope `https://www.googleapis.com/auth/gmail.send` (OAuth Playground o script propio) → `GMAIL_OAUTH_REFRESH_TOKEN`.
4. La casilla emisora → `GMAIL_USER`.

> Nota operativa: si las credenciales se rotan o vencen, las subidas a Drive devuelven 403 y los emails fallan. Ante ese síntoma, revisar Runtime Logs en Vercel: `invalid_grant` = regenerar token/key.

## 6. Cron jobs (Vercel)

En `vercel.json` (o Vercel → Settings → Cron Jobs) configurar:

| Endpoint | Frecuencia sugerida | Función |
|---|---|---|
| `/api/backup?secret=CRON_SECRET` | diario (madrugada) | backup de datos |
| `/api/notificaciones?secret=CRON_SECRET` | cada 15 min | envío de emails encolados |

Usar el mismo `CRON_SECRET` de las variables de entorno.

## 7. Primer usuario administrador

1. Supabase → Authentication → Users → **Add user** (email + contraseña del admin del cliente).
2. En SQL Editor, asignarle rol:

   ```sql
   insert into public.perfiles (id, rol)
   values ('UUID-DEL-USUARIO', 'administrador')
   on conflict (id) do update set rol = 'administrador';
   ```

3. Ingresar a la app → configurar el **MFA (TOTP)** cuando lo exija (obligatorio).
4. Crear el resto del equipo desde Administración → Usuarios (rol operador o administrador).

## 8. Configuración inicial de negocio

Desde Administración → Configuración, cargar en este orden:

1. **Cuentas bancarias propias** (banco, alias, CBU) con su **multa por rechazo** y **costo de procesamiento %**.
2. **Feriados** del año (para el cálculo de acreditación en días hábiles).
3. **Umbrales PLAFT** (acumulado mensual por destino: persona física y jurídica) según la política de cumplimiento del cliente.
4. **Convenios** si aplica.
5. Clientes con sus **tarifas** (fee cámara y fee interior) desde el módulo Clientes.
6. Verificar el catálogo de **bancos** (tabla `bancos`) y ajustar si el cliente opera con entidades no listadas.

## 9. Checklist final de puesta en marcha

- [ ] Login + alta de MFA funcionan.
- [ ] Carga de un cheque de prueba: plaza y fee se calculan solos.
- [ ] Cambio de estados hasta procesado: se genera la acreditación al cliente.
- [ ] Rechazo de prueba: débito de fee + multa y email de notificación.
- [ ] Liquidación de prueba: banner PLAFT visible, saldo descuenta.
- [ ] Portal del cliente: acceso con PIN, extracto descarga.
- [ ] Export XLS de cheques respeta filtros.
- [ ] Foto de cheque sube a Drive (si se configuró).
- [ ] Cron de backup ejecutó al menos una vez (ver logs).
- [ ] Borrar los datos de prueba (Zona de peligro de cada cheque de prueba).
- [ ] 2FA activado en las cuentas de infraestructura (GitHub, Vercel, Supabase, Google Cloud).
