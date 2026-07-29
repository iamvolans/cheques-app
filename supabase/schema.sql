


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."estado_cheque" AS ENUM (
    'aceptado',
    'depositado',
    'procesado',
    'rechazado',
    'en_custodia'
);


ALTER TYPE "public"."estado_cheque" OWNER TO "postgres";


CREATE TYPE "public"."rol_usuario" AS ENUM (
    'operador',
    'administrador'
);


ALTER TYPE "public"."rol_usuario" OWNER TO "postgres";


CREATE TYPE "public"."tipo_cheque" AS ENUM (
    'fisico',
    'echeq'
);


ALTER TYPE "public"."tipo_cheque" OWNER TO "postgres";


CREATE TYPE "public"."tipo_movimiento" AS ENUM (
    'acreditacion',
    'debito_rechazo',
    'liquidacion',
    'ajuste_manual'
);


ALTER TYPE "public"."tipo_movimiento" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_hoy"() RETURNS "date"
    LANGUAGE "sql" STABLE
    SET "search_path" TO 'public'
    AS $$ select (now() at time zone 'America/Argentina/Buenos_Aires')::date $$;


ALTER FUNCTION "public"."fn_hoy"() OWNER TO "postgres";


COMMENT ON FUNCTION "public"."fn_hoy"() IS 'Fecha de hoy en hora argentina. La base corre en UTC: usar current_date corre el dia entre las 21:00 y las 24:00 locales.';


SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."lotes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "fecha" "date" DEFAULT "public"."fn_hoy"() NOT NULL,
    "numero" integer NOT NULL,
    "estado" "text" DEFAULT 'abierto'::"text" NOT NULL,
    "abierto_por" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "abierto_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cerrado_at" timestamp with time zone,
    CONSTRAINT "lotes_estado_check" CHECK (("estado" = ANY (ARRAY['abierto'::"text", 'cerrado'::"text"]))),
    CONSTRAINT "lotes_numero_check" CHECK (("numero" >= 1))
);


ALTER TABLE "public"."lotes" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_abrir_lote"("p_cliente_id" "uuid") RETURNS "public"."lotes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_lote public.lotes;
  v_num integer;
  v_hoy date := public.fn_hoy();
begin
  if auth.uid() is null then
    raise exception 'Sesión no válida';
  end if;

  select * into v_lote from public.lotes
    where abierto_por = auth.uid() and estado = 'abierto' limit 1;
  if found then
    if v_lote.cliente_id <> p_cliente_id then
      raise exception 'Ya tenés un lote abierto para otro cliente. Cerralo antes de abrir uno nuevo.';
    end if;
    return v_lote;
  end if;

  perform 1 from public.clientes where id = p_cliente_id for update;
  if not found then
    raise exception 'Cliente inexistente';
  end if;

  select coalesce(max(numero), 0) + 1 into v_num
    from public.lotes where cliente_id = p_cliente_id and fecha = v_hoy;

  insert into public.lotes (cliente_id, fecha, numero)
    values (p_cliente_id, v_hoy, v_num)
    returning * into v_lote;

  return v_lote;
end; $$;


ALTER FUNCTION "public"."fn_abrir_lote"("p_cliente_id" "uuid") OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."recibos_devolucion_numero_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."recibos_devolucion_numero_seq" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recibos_devolucion" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "numero" integer DEFAULT "nextval"('"public"."recibos_devolucion_numero_seq"'::"regclass") NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "fecha" "date" DEFAULT "public"."fn_hoy"() NOT NULL,
    "cantidad" integer NOT NULL,
    "total" numeric(15,2) NOT NULL,
    "estado" "text" DEFAULT 'emitido'::"text" NOT NULL,
    "firma_png" "text",
    "firma_aclaracion" "text",
    "firma_dni" "text",
    "firma_at" timestamp with time zone,
    "firma_hash" "text",
    "firma_ip" "text",
    "firma_user_agent" "text",
    "anulado_at" timestamp with time zone,
    "anulado_por" "uuid",
    "anulado_motivo" "text",
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "recibos_estado_check" CHECK (("estado" = ANY (ARRAY['emitido'::"text", 'firmado'::"text", 'anulado'::"text"])))
);


ALTER TABLE "public"."recibos_devolucion" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_anular_recibo"("p_recibo_id" "uuid", "p_motivo" "text") RETURNS "public"."recibos_devolucion"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_recibo public.recibos_devolucion;
begin
  if not public.fn_es_admin() then
    raise exception 'Solo un Administrador puede anular un recibo de devolución';
  end if;
  if coalesce(trim(p_motivo), '') = '' then
    raise exception 'Indicá el motivo de la anulación';
  end if;

  update public.recibos_devolucion
     set estado = 'anulado', anulado_at = now(),
         anulado_por = auth.uid(), anulado_motivo = trim(p_motivo)
   where id = p_recibo_id and estado <> 'anulado'
   returning * into v_recibo;
  if not found then raise exception 'El recibo no existe o ya estaba anulado'; end if;

  update public.cheques set recibo_id = null where recibo_id = p_recibo_id;
  return v_recibo;
end; $$;


ALTER FUNCTION "public"."fn_anular_recibo"("p_recibo_id" "uuid", "p_motivo" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_auditar"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_email text;
  v_desc  text;
  v_new   jsonb := case when tg_op = 'DELETE' then null else to_jsonb(new) end;
  v_old   jsonb := case when tg_op = 'INSERT' then null else to_jsonb(old) end;
begin
  select email into v_email from public.perfiles where id = auth.uid();

  if tg_table_name = 'cheques' and tg_op = 'UPDATE'
     and (v_new->>'estado') is distinct from (v_old->>'estado') then
    v_desc := format('Cambió estado Cheque %s de %s a %s',
                     v_new->>'numero_cheque', v_old->>'estado', v_new->>'estado');
  else
    v_desc := tg_op || ' en ' || tg_table_name;
  end if;

  insert into public.logs_auditoria
    (usuario_id, usuario_email, tabla, registro_id, accion, descripcion, valores_antes, valores_despues)
  values
    (auth.uid(), v_email, tg_table_name,
     coalesce(coalesce(v_new, v_old)->>'id', '00000000-0000-0000-0000-000000000000')::uuid,
     tg_op, v_desc, v_old, v_new);

  return coalesce(new, old);
end; $$;


ALTER FUNCTION "public"."fn_auditar"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cerrar_lote"("p_lote_id" "uuid") RETURNS "public"."lotes"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare v_lote public.lotes;
begin
  update public.lotes set estado = 'cerrado', cerrado_at = now()
    where id = p_lote_id and estado = 'abierto'
    returning * into v_lote;
  if not found then
    raise exception 'El lote no existe o ya estaba cerrado';
  end if;
  return v_lote;
end; $$;


ALTER FUNCTION "public"."fn_cerrar_lote"("p_lote_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cheques_after_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_debito numeric(15,2);
begin
  -- PROCESADO: acreditar al cliente (monto - fee)
  if new.estado = 'procesado' and old.estado is distinct from 'procesado' then
    insert into public.movimientos_clientes (cliente_id, cheque_id, tipo, monto, descripcion, created_by)
    values (new.cliente_id, new.id, 'acreditacion',
            new.monto - new.fee_calculado,
            format('Acreditación cheque N° %s (monto %s - fee %s)', new.numero_cheque, new.monto, new.fee_calculado),
            auth.uid());
  end if;

  -- RECHAZADO: debitar (fee + multa) y encolar email automático
  if new.estado = 'rechazado' and old.estado is distinct from 'rechazado' then
    v_debito := new.fee_calculado + new.multa;

    -- Si ya se había acreditado (estaba procesado), revertir la acreditación
    if old.estado = 'procesado' then
      insert into public.movimientos_clientes (cliente_id, cheque_id, tipo, monto, descripcion, created_by)
      values (new.cliente_id, new.id, 'debito_rechazo',
              -(new.monto - new.fee_calculado),
              format('Reversa de acreditación por rechazo de cheque N° %s', new.numero_cheque),
              auth.uid());
    end if;

    insert into public.movimientos_clientes (cliente_id, cheque_id, tipo, monto, descripcion, created_by)
    values (new.cliente_id, new.id, 'debito_rechazo', -v_debito,
            format('Débito por rechazo cheque N° %s: fee %s + multa %s', new.numero_cheque, new.fee_calculado, new.multa),
            auth.uid());

    insert into public.notificaciones_pendientes (cliente_id, cheque_id, tipo, payload)
    values (new.cliente_id, new.id, 'cheque_rechazado',
            jsonb_build_object(
              'numero_cheque', new.numero_cheque,
              'librador', new.librador,
              'monto', new.monto,
              'fee', new.fee_calculado,
              'multa', new.multa,
              'total_debitado', v_debito,
              'motivo', coalesce(new.motivo_rechazo, 'Falta de fondos')
            ));
  end if;

  return new;
end; $$;


ALTER FUNCTION "public"."fn_cheques_after_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cheques_before_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_fee numeric(5,3);
  v_lote_cliente uuid;
  v_hoy date := public.fn_hoy();
begin
  if new.fecha_cobro > v_hoy + 90 then
    raise exception 'La fecha de cobro (%) supera el máximo de diferimiento de 90 días', new.fecha_cobro;
  end if;

  new.fecha_carga := coalesce(new.fecha_carga, v_hoy);
  if new.fecha_carga > v_hoy then
    raise exception 'La fecha de carga (%) no puede ser futura', new.fecha_carga;
  end if;

  if new.codigo_postal is not null then
    new.plaza := case when new.codigo_postal <= 2000 then 'camara' else 'interior' end;
  end if;

  select case
           when new.plaza = 'interior' then coalesce(fee_interior_porcentaje, fee_porcentaje)
           else fee_porcentaje
         end
    into v_fee
  from public.clientes where id = new.cliente_id;

  if v_fee is null then
    raise exception 'Cliente inexistente';
  end if;
  new.fee_aplicado_pct := v_fee;
  new.fee_calculado    := round(new.monto * v_fee / 100, 2);

  if new.fecha_cobro > v_hoy then
    new.estado := 'en_custodia';
  end if;

  if new.fecha_deposito is not null then
    if new.fecha_cobro > v_hoy then
      raise exception 'No se puede depositar por adelantado: la fecha de pago (%) todavía no llegó', new.fecha_cobro;
    end if;
    if new.fecha_deposito > v_hoy then
      raise exception 'La fecha de depósito (%) no puede ser futura', new.fecha_deposito;
    end if;
    new.estado := 'depositado';
    new.fecha_estimada_acred := public.fn_sumar_dias_habiles(new.fecha_deposito, 2);
  end if;

  if new.lote_id is not null then
    perform 1 from public.lotes where id = new.lote_id for update;
    select cliente_id into v_lote_cliente from public.lotes where id = new.lote_id;
    if v_lote_cliente is null then
      raise exception 'El lote indicado no existe';
    end if;
    if v_lote_cliente <> new.cliente_id then
      raise exception 'El cheque pertenece a un cliente distinto al del lote';
    end if;
    if new.foto_numero is null then
      select coalesce(max(foto_numero), 0) + 1 into new.foto_numero
        from public.cheques where lote_id = new.lote_id;
    end if;
  else
    new.foto_numero := null;
  end if;

  new.alerta_lista_negra := exists (
    select 1 from public.lista_negra_libradores
    where regexp_replace(cuit, '-', '', 'g') = regexp_replace(new.cuit_librador, '-', '', 'g')
  );

  new.created_by := auth.uid();
  return new;
end; $$;


ALTER FUNCTION "public"."fn_cheques_before_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_cheques_before_update"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_hoy date := public.fn_hoy();
begin
  if new.estado = 'rechazado' and old.estado is distinct from 'rechazado'
     and not public.fn_es_admin() then
    raise exception 'Solo un Administrador puede aprobar el estado Rechazado';
  end if;
  if new.multa is distinct from old.multa and not public.fn_es_admin() then
    raise exception 'Solo un Administrador puede cargar o modificar la Multa';
  end if;
  if new.gasto_bancario is distinct from old.gasto_bancario and not public.fn_es_admin() then
    raise exception 'Solo un Administrador puede registrar el gasto bancario';
  end if;

  if old.recibo_id is not null
     and new.recibo_id is not distinct from old.recibo_id
     and exists (select 1 from public.recibos_devolucion r
                  where r.id = old.recibo_id and r.estado = 'firmado') then
    raise exception 'El cheque está en el recibo de devolución N° % ya firmado. Anulá el recibo para poder modificarlo.',
      (select numero from public.recibos_devolucion where id = old.recibo_id);
  end if;

  if new.estado = 'depositado' and old.estado is distinct from 'depositado' then
    if new.fecha_cobro > v_hoy then
      raise exception 'Este cheque está en custodia: recién se puede depositar el %', new.fecha_cobro;
    end if;
    new.fecha_deposito := coalesce(new.fecha_deposito, v_hoy);
    new.fecha_estimada_acred := public.fn_sumar_dias_habiles(new.fecha_deposito, 2);
  end if;

  new.updated_at := now();
  return new;
end; $$;


ALTER FUNCTION "public"."fn_cheques_before_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_crear_recibo_devolucion"("p_cliente_id" "uuid", "p_cheque_ids" "uuid"[]) RETURNS "public"."recibos_devolucion"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_recibo public.recibos_devolucion;
  v_cant integer;
  v_total numeric(15,2);
  v_malos integer;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if p_cheque_ids is null or array_length(p_cheque_ids, 1) is null then
    raise exception 'No seleccionaste ningún cheque';
  end if;

  perform 1 from public.cheques where id = any(p_cheque_ids) for update;

  select count(*) into v_malos from public.cheques
   where id = any(p_cheque_ids)
     and (cliente_id <> p_cliente_id or estado <> 'rechazado' or recibo_id is not null);
  if v_malos > 0 then
    raise exception 'Hay % cheque(s) que no corresponden: deben ser del mismo cliente, estar rechazados y no tener un recibo vigente', v_malos;
  end if;

  select count(*), coalesce(sum(monto), 0) into v_cant, v_total
    from public.cheques where id = any(p_cheque_ids);
  if v_cant <> array_length(p_cheque_ids, 1) then
    raise exception 'Alguno de los cheques indicados no existe';
  end if;

  insert into public.recibos_devolucion (cliente_id, cantidad, total)
    values (p_cliente_id, v_cant, v_total) returning * into v_recibo;

  insert into public.recibos_devolucion_items
    (recibo_id, cheque_id, numero_cheque, librador, cuit_librador, banco_emisor, motivo_rechazo, monto)
  select v_recibo.id, c.id, c.numero_cheque, c.librador, c.cuit_librador,
         c.banco_emisor, c.motivo_rechazo, c.monto
    from public.cheques c where c.id = any(p_cheque_ids);

  update public.cheques set recibo_id = v_recibo.id where id = any(p_cheque_ids);

  return v_recibo;
end; $$;


ALTER FUNCTION "public"."fn_crear_recibo_devolucion"("p_cliente_id" "uuid", "p_cheque_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_es_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select coalesce(public.fn_rol_actual() = 'administrador', false);
$$;


ALTER FUNCTION "public"."fn_es_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_firmar_recibo"("p_recibo_id" "uuid", "p_png" "text", "p_aclaracion" "text", "p_dni" "text", "p_hash" "text", "p_ip" "text", "p_ua" "text") RETURNS "public"."recibos_devolucion"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_recibo public.recibos_devolucion;
begin
  if auth.uid() is null then raise exception 'Sesión no válida'; end if;
  if coalesce(trim(p_aclaracion), '') = '' then raise exception 'Falta la aclaración de quien recibe'; end if;
  if regexp_replace(coalesce(p_dni, ''), '\D', '', 'g') !~ '^[0-9]{7,8}$' then
    raise exception 'El DNI debe tener 7 u 8 dígitos';
  end if;
  if p_png is null or length(p_png) < 200 then raise exception 'Falta la firma'; end if;
  if length(p_png) > 300000 then raise exception 'La firma es demasiado pesada'; end if;

  select * into v_recibo from public.recibos_devolucion where id = p_recibo_id for update;
  if not found then raise exception 'El recibo no existe'; end if;
  if v_recibo.estado = 'anulado' then raise exception 'El recibo está anulado'; end if;
  if v_recibo.estado = 'firmado' then raise exception 'El recibo ya fue firmado'; end if;

  -- Primero los cheques: despues de marcar firmado, el trigger los congela
  update public.cheques
     set rechazo_entregado_at = coalesce(rechazo_entregado_at, now())
   where recibo_id = p_recibo_id;

  update public.recibos_devolucion
     set estado = 'firmado', firma_png = p_png,
         firma_aclaracion = trim(p_aclaracion),
         firma_dni = regexp_replace(p_dni, '\D', '', 'g'),
         firma_at = now(), firma_hash = p_hash,
         firma_ip = p_ip, firma_user_agent = p_ua
   where id = p_recibo_id
   returning * into v_recibo;

  return v_recibo;
end; $_$;


ALTER FUNCTION "public"."fn_firmar_recibo"("p_recibo_id" "uuid", "p_png" "text", "p_aclaracion" "text", "p_dni" "text", "p_hash" "text", "p_ip" "text", "p_ua" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  insert into public.perfiles (id, nombre, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'nombre', new.email), new.email);
  return new;
end; $$;


ALTER FUNCTION "public"."fn_handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_historial_cliente"("p_cliente_id" "uuid") RETURNS TABLE("created_at" timestamp with time zone, "usuario_email" "text", "accion" "text", "tabla" "text", "descripcion" "text")
    LANGUAGE "sql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select l.created_at, l.usuario_email, l.accion, l.tabla, l.descripcion
  from public.logs_auditoria l
  where l.registro_id = p_cliente_id
     or l.registro_id in (select id from public.cheques where cliente_id = p_cliente_id)
     or l.registro_id in (select id from public.liquidaciones where cliente_id = p_cliente_id)
  order by l.created_at desc
  limit 100;
$$;


ALTER FUNCTION "public"."fn_historial_cliente"("p_cliente_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_liquidaciones_after_insert"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_saldo numeric(15,2);
begin
  select coalesce(sum(monto), 0) into v_saldo
  from public.movimientos_clientes where cliente_id = new.cliente_id;

  if new.monto_liquidado > v_saldo then
    raise exception 'Saldo insuficiente: disponible %, intentando liquidar %', v_saldo, new.monto_liquidado;
  end if;

  insert into public.movimientos_clientes (cliente_id, liquidacion_id, tipo, monto, descripcion, created_by)
  values (new.cliente_id, new.id, 'liquidacion', -new.monto_liquidado,
          format('Liquidación Coelsa %s a %s', new.coelsa_id, new.beneficiario),
          auth.uid());
  return new;
end; $$;


ALTER FUNCTION "public"."fn_liquidaciones_after_insert"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_logs_inmutables"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  raise exception 'Los logs de auditoría son inmutables';
end; $$;


ALTER FUNCTION "public"."fn_logs_inmutables"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_marcar_resolucion"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  if new.estado in ('procesado','rechazado') and old.estado is distinct from new.estado then
    new.fecha_resolucion := now();
  end if;
  return new;
end $$;


ALTER FUNCTION "public"."fn_marcar_resolucion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_notif_solicitud"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare v_cliente text;
begin
  select razon_social into v_cliente from public.clientes where id = new.cliente_id;
  insert into public.notificaciones (tipo, titulo, detalle, link, cliente_id)
  values (
    'solicitud_liquidacion',
    'Nueva solicitud de transferencia',
    coalesce(v_cliente, 'Cliente') || ' solicitó $' || trim(to_char(new.monto, 'FM999G999G990D00')) || ' → ' || coalesce(new.beneficiario, ''),
    '/liquidaciones',
    new.cliente_id
  );
  return new;
end $_$;


ALTER FUNCTION "public"."fn_notif_solicitud"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_proteger_fee_cliente"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
begin
  if new.fee_porcentaje is distinct from old.fee_porcentaje
     and not public.fn_es_admin() then
    raise exception 'Solo un Administrador puede modificar el Fee del cliente';
  end if;
  new.updated_at := now();
  return new;
end; $$;


ALTER FUNCTION "public"."fn_proteger_fee_cliente"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_rol_actual"() RETURNS "public"."rol_usuario"
    LANGUAGE "sql" STABLE SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
  select rol from public.perfiles where id = auth.uid();
$$;


ALTER FUNCTION "public"."fn_rol_actual"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_sumar_dias_habiles"("fecha_inicio" "date", "dias" integer) RETURNS "date"
    LANGUAGE "plpgsql" STABLE
    AS $$
declare
  f date := fecha_inicio;
  contados integer := 0;
begin
  while contados < dias loop
    f := f + 1;
    if extract(isodow from f) < 6
       and not exists (select 1 from public.feriados where fecha = f) then
      contados := contados + 1;
    end if;
  end loop;
  return f;
end; $$;


ALTER FUNCTION "public"."fn_sumar_dias_habiles"("fecha_inicio" "date", "dias" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_liquidacion"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_saldo numeric;
  v_razon text;
begin
  -- Serializa por cliente: dos liquidaciones simultaneas no pueden pasar las dos
  perform 1 from public.clientes where id = new.cliente_id for update;

  select coalesce(sum(monto), 0) into v_saldo
    from public.movimientos_clientes where cliente_id = new.cliente_id;

  if new.monto_liquidado > v_saldo then
    select razon_social into v_razon from public.clientes where id = new.cliente_id;
    raise exception 'Saldo insuficiente para %: disponible $ %, se intentó liquidar $ %',
      coalesce(v_razon, new.cliente_id::text), round(v_saldo, 2), round(new.monto_liquidado, 2);
  end if;

  return new;
end; $_$;


ALTER FUNCTION "public"."fn_validar_liquidacion"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."fn_validar_solicitud"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $_$
declare
  v_saldo numeric;
  v_pendiente numeric;
  v_cant int;
  v_prefijo text;
  v_hora int;
begin
  v_hora := extract(hour from now() at time zone 'America/Argentina/Buenos_Aires');
  if v_hora >= 15 then
    raise exception 'Las solicitudes se reciben hasta las 15:00 hs. Cargala mañana y la procesamos a primera hora.';
  end if;

  if new.monto < 500000 then
    raise exception 'El monto mínimo por transferencia es de $500.000';
  end if;

  if new.cuit_beneficiario is null or length(regexp_replace(new.cuit_beneficiario, '\D', '', 'g')) <> 11 then
    raise exception 'El CUIT/CUIL del beneficiario es obligatorio (11 dígitos)';
  end if;

  if exists (
    select 1 from public.cuits_destino_bloqueados b
    where regexp_replace(b.cuit, '\D', '', 'g') = regexp_replace(new.cuit_beneficiario, '\D', '', 'g')
  ) then
    raise exception 'Este destino no admite nuevas transferencias. Consultá con administración.';
  end if;

  v_prefijo := substring(regexp_replace(new.cuit_beneficiario, '\D', '', 'g') from 1 for 2);
  if v_prefijo in ('20','23','24','27') and new.monto > 6000000 then
    raise exception 'Transferencias a personas físicas: máximo $6.000.000 por operación';
  end if;

  select coalesce(sum(monto), 0) into v_saldo
    from public.movimientos_clientes where cliente_id = new.cliente_id;
  select coalesce(sum(monto), 0), count(*) into v_pendiente, v_cant
    from public.solicitudes_liquidacion
    where cliente_id = new.cliente_id and estado = 'pendiente';

  if v_cant >= 10 then
    raise exception 'Hay demasiadas solicitudes pendientes; aguardá a que se procesen';
  end if;
  if new.monto > v_saldo - v_pendiente then
    raise exception 'El monto supera tu saldo disponible (contando solicitudes pendientes)';
  end if;

  return new;
end $_$;


ALTER FUNCTION "public"."fn_validar_solicitud"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."bancos" (
    "id" integer NOT NULL,
    "nombre" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "orden" integer DEFAULT 100 NOT NULL
);


ALTER TABLE "public"."bancos" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."bancos_id_seq"
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."bancos_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."bancos_id_seq" OWNED BY "public"."bancos"."id";



CREATE TABLE IF NOT EXISTS "public"."cheques" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "tipo" "public"."tipo_cheque" DEFAULT 'fisico'::"public"."tipo_cheque" NOT NULL,
    "numero_cheque" "text" NOT NULL,
    "librador" "text" NOT NULL,
    "cuit_librador" "text" NOT NULL,
    "monto" numeric(15,2) NOT NULL,
    "endosos" integer DEFAULT 0 NOT NULL,
    "banco_emisor" "text" NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "convenio_id" "uuid" NOT NULL,
    "cuenta_bancaria_id" "uuid" NOT NULL,
    "echeq_id" "text",
    "pdf_endoso_url" "text",
    "foto_frente_url" "text",
    "foto_dorso_url" "text",
    "portador_banco" "text",
    "fecha_cobro" "date" NOT NULL,
    "fecha_deposito" "date",
    "fecha_estimada_acred" "date",
    "estado" "public"."estado_cheque" DEFAULT 'aceptado'::"public"."estado_cheque" NOT NULL,
    "fee_aplicado_pct" numeric(5,3) NOT NULL,
    "fee_calculado" numeric(15,2) NOT NULL,
    "multa" numeric(15,2) DEFAULT 0 NOT NULL,
    "motivo_rechazo" "text",
    "alerta_lista_negra" boolean DEFAULT false NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fecha_resolucion" timestamp with time zone,
    "codigo_postal" integer,
    "plaza" "text",
    "gasto_bancario" numeric(15,2) DEFAULT 0 NOT NULL,
    "fecha_pago" "date",
    "rechazo_notificado_at" timestamp with time zone,
    "rechazo_recuperado_at" timestamp with time zone,
    "rechazo_entregado_at" timestamp with time zone,
    "fecha_carga" "date" DEFAULT "public"."fn_hoy"() NOT NULL,
    "lote_id" "uuid",
    "foto_numero" integer,
    "recibo_id" "uuid",
    CONSTRAINT "cheques_codigo_postal_check" CHECK ((("codigo_postal" >= 1) AND ("codigo_postal" <= 9999))),
    CONSTRAINT "cheques_cuit_librador_check" CHECK (("cuit_librador" ~ '^[0-9]{2}-?[0-9]{8}-?[0-9]$'::"text")),
    CONSTRAINT "cheques_endosos_check" CHECK (("endosos" >= 0)),
    CONSTRAINT "cheques_gasto_bancario_check" CHECK (("gasto_bancario" >= (0)::numeric)),
    CONSTRAINT "cheques_monto_check" CHECK (("monto" > (0)::numeric)),
    CONSTRAINT "cheques_multa_check" CHECK (("multa" >= (0)::numeric)),
    CONSTRAINT "cheques_plaza_check" CHECK (("plaza" = ANY (ARRAY['camara'::"text", 'interior'::"text"]))),
    CONSTRAINT "chk_cheques_foto_numero" CHECK ((("foto_numero" IS NULL) OR ("foto_numero" >= 1))),
    CONSTRAINT "chk_echeq_requiere_id" CHECK ((("tipo" <> 'echeq'::"public"."tipo_cheque") OR ("echeq_id" IS NOT NULL)))
);


ALTER TABLE "public"."cheques" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cheques_backup_fechas_20260723" (
    "id" "uuid",
    "numero_cheque" "text",
    "fecha_cobro" "date",
    "fecha_deposito" "date",
    "created_at" timestamp with time zone,
    "updated_at" timestamp with time zone
);


ALTER TABLE "public"."cheques_backup_fechas_20260723" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."clientes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "razon_social" "text" NOT NULL,
    "cuit" "text" NOT NULL,
    "email" "text" NOT NULL,
    "fee_porcentaje" numeric(5,3) NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "fee_interior_porcentaje" numeric(5,3),
    "portal_token" "text",
    "portal_pin_hash" "text",
    "portal_totp_secret" "text",
    "portal_totp_activo" boolean DEFAULT false NOT NULL,
    CONSTRAINT "clientes_cuit_check" CHECK (("cuit" ~ '^[0-9]{2}-?[0-9]{8}-?[0-9]$'::"text")),
    CONSTRAINT "clientes_email_check" CHECK (("email" ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'::"text")),
    CONSTRAINT "clientes_fee_interior_porcentaje_check" CHECK ((("fee_interior_porcentaje" IS NULL) OR (("fee_interior_porcentaje" >= (0)::numeric) AND ("fee_interior_porcentaje" <= (100)::numeric)))),
    CONSTRAINT "clientes_fee_porcentaje_check" CHECK ((("fee_porcentaje" >= (0)::numeric) AND ("fee_porcentaje" <= (100)::numeric)))
);


ALTER TABLE "public"."clientes" OWNER TO "postgres";


COMMENT ON COLUMN "public"."clientes"."portal_pin_hash" IS 'Hash bcrypt del PIN de acceso al portal (configurado por admin)';



COMMENT ON COLUMN "public"."clientes"."portal_totp_secret" IS 'Secreto TOTP del cliente (2FA opcional del portal)';



COMMENT ON COLUMN "public"."clientes"."portal_totp_activo" IS 'Si el cliente activó 2FA en su portal';



CREATE TABLE IF NOT EXISTS "public"."convenios" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "razon_social" "text" NOT NULL,
    "cuit" "text" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."convenios" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuentas_bancarias_empresa" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "banco" "text" NOT NULL,
    "alias" "text",
    "cbu" "text",
    "descripcion" "text",
    "activa" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "multa_rechazo_banco" numeric(15,2) DEFAULT 0 NOT NULL,
    "costo_bancario_pct" numeric(5,3) DEFAULT 0 NOT NULL,
    CONSTRAINT "cuentas_bancarias_empresa_multa_rechazo_banco_check" CHECK (("multa_rechazo_banco" >= (0)::numeric))
);


ALTER TABLE "public"."cuentas_bancarias_empresa" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."cuits_destino_bloqueados" (
    "cuit" "text" NOT NULL,
    "motivo" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."cuits_destino_bloqueados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."feriados" (
    "fecha" "date" NOT NULL,
    "descripcion" "text" NOT NULL
);


ALTER TABLE "public"."feriados" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."liquidaciones" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "coelsa_id" "text" NOT NULL,
    "fecha_transferencia" "date" NOT NULL,
    "cvu_cbu_destino" "text",
    "beneficiario" "text" NOT NULL,
    "monto_liquidado" numeric(15,2) NOT NULL,
    "created_by" "uuid" DEFAULT "auth"."uid"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "cuit_beneficiario" "text",
    "alias_destino" "text",
    CONSTRAINT "chk_liq_destino" CHECK (((("cvu_cbu_destino" IS NULL) OR ("length"("regexp_replace"("cvu_cbu_destino", '[^0-9]'::"text", ''::"text", 'g'::"text")) = 22)) AND (("cvu_cbu_destino" IS NOT NULL) OR ("alias_destino" IS NOT NULL)))),
    CONSTRAINT "liquidaciones_monto_liquidado_check" CHECK (("monto_liquidado" > (0)::numeric))
);


ALTER TABLE "public"."liquidaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."lista_negra_libradores" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cuit" "text" NOT NULL,
    "razon_social" "text",
    "motivo" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."lista_negra_libradores" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."logs_auditoria" (
    "id" bigint NOT NULL,
    "usuario_id" "uuid",
    "usuario_email" "text",
    "tabla" "text" NOT NULL,
    "registro_id" "uuid" NOT NULL,
    "accion" "text" NOT NULL,
    "descripcion" "text",
    "valores_antes" "jsonb",
    "valores_despues" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."logs_auditoria" OWNER TO "postgres";


ALTER TABLE "public"."logs_auditoria" ALTER COLUMN "id" ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME "public"."logs_auditoria_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."movimientos_clientes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "cheque_id" "uuid",
    "liquidacion_id" "uuid",
    "tipo" "public"."tipo_movimiento" NOT NULL,
    "monto" numeric(15,2) NOT NULL,
    "descripcion" "text" NOT NULL,
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."movimientos_clientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tipo" "text" NOT NULL,
    "titulo" "text" NOT NULL,
    "detalle" "text",
    "link" "text",
    "cliente_id" "uuid",
    "leida" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notificaciones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."notificaciones_pendientes" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "cheque_id" "uuid",
    "tipo" "text" NOT NULL,
    "payload" "jsonb" NOT NULL,
    "enviada" boolean DEFAULT false NOT NULL,
    "enviada_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."notificaciones_pendientes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."perfiles" (
    "id" "uuid" NOT NULL,
    "nombre" "text" NOT NULL,
    "email" "text" NOT NULL,
    "rol" "public"."rol_usuario" DEFAULT 'operador'::"public"."rol_usuario" NOT NULL,
    "activo" boolean DEFAULT true NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."perfiles" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."plaft_parametros" (
    "id" integer DEFAULT 1 NOT NULL,
    "umbral_mensual_fisica" numeric(15,2) DEFAULT 10000000 NOT NULL,
    "umbral_mensual_juridica" numeric(15,2) DEFAULT 50000000 NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "plaft_parametros_id_check" CHECK (("id" = 1))
);


ALTER TABLE "public"."plaft_parametros" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."recibos_devolucion_items" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "recibo_id" "uuid" NOT NULL,
    "cheque_id" "uuid" NOT NULL,
    "numero_cheque" "text" NOT NULL,
    "librador" "text" NOT NULL,
    "cuit_librador" "text" NOT NULL,
    "banco_emisor" "text" NOT NULL,
    "motivo_rechazo" "text",
    "monto" numeric(15,2) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."recibos_devolucion_items" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."solicitudes_liquidacion" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "cliente_id" "uuid" NOT NULL,
    "monto" numeric(15,2) NOT NULL,
    "cvu_cbu_destino" "text",
    "alias_destino" "text",
    "cuit_beneficiario" "text",
    "beneficiario" "text" NOT NULL,
    "nota" "text",
    "estado" "text" DEFAULT 'pendiente'::"text" NOT NULL,
    "motivo_rechazo" "text",
    "liquidacion_id" "uuid",
    "comprobante_drive_id" "text",
    "comprobante_nombre" "text",
    "comprobante_subido_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "chk_sol_destino" CHECK ((("cvu_cbu_destino" IS NOT NULL) OR ("alias_destino" IS NOT NULL))),
    CONSTRAINT "solicitudes_liquidacion_estado_check" CHECK (("estado" = ANY (ARRAY['pendiente'::"text", 'procesada'::"text", 'rechazada'::"text"]))),
    CONSTRAINT "solicitudes_liquidacion_monto_check" CHECK (("monto" > (0)::numeric))
);


ALTER TABLE "public"."solicitudes_liquidacion" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_exposicion_banco" AS
 WITH "cartera" AS (
         SELECT "cheques"."banco_emisor",
            "cheques"."monto"
           FROM "public"."cheques"
          WHERE ("cheques"."estado" = ANY (ARRAY['en_custodia'::"public"."estado_cheque", 'aceptado'::"public"."estado_cheque", 'depositado'::"public"."estado_cheque"]))
        ), "total" AS (
         SELECT NULLIF("sum"("cartera_1"."monto"), (0)::numeric) AS "t"
           FROM "cartera" "cartera_1"
        )
 SELECT COALESCE("banco_emisor", 'Sin banco'::"text") AS "banco",
    "count"(*) AS "cheques",
    "sum"("monto") AS "monto",
    "round"(((100.0 * "sum"("monto")) / ( SELECT "total"."t"
           FROM "total")), 2) AS "pct"
   FROM "cartera"
  GROUP BY "banco_emisor"
  ORDER BY ("sum"("monto")) DESC;


ALTER VIEW "public"."vw_exposicion_banco" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_exposicion_cliente" AS
 WITH "cartera" AS (
         SELECT "cheques"."cliente_id",
            "cheques"."monto"
           FROM "public"."cheques"
          WHERE ("cheques"."estado" = ANY (ARRAY['en_custodia'::"public"."estado_cheque", 'aceptado'::"public"."estado_cheque", 'depositado'::"public"."estado_cheque"]))
        ), "total" AS (
         SELECT NULLIF("sum"("cartera"."monto"), (0)::numeric) AS "t"
           FROM "cartera"
        )
 SELECT "c"."cliente_id",
    "cl"."razon_social",
    "count"(*) AS "cheques",
    "sum"("c"."monto") AS "monto",
    "round"(((100.0 * "sum"("c"."monto")) / ( SELECT "total"."t"
           FROM "total")), 2) AS "pct"
   FROM ("cartera" "c"
     JOIN "public"."clientes" "cl" ON (("cl"."id" = "c"."cliente_id")))
  GROUP BY "c"."cliente_id", "cl"."razon_social"
  ORDER BY ("sum"("c"."monto")) DESC;


ALTER VIEW "public"."vw_exposicion_cliente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_concentracion_resumen" AS
 SELECT ( SELECT COALESCE("sum"("cheques"."monto"), (0)::numeric) AS "coalesce"
           FROM "public"."cheques"
          WHERE ("cheques"."estado" = ANY (ARRAY['en_custodia'::"public"."estado_cheque", 'aceptado'::"public"."estado_cheque", 'depositado'::"public"."estado_cheque"]))) AS "cartera_total",
    ( SELECT "max"("vw_exposicion_cliente"."pct") AS "max"
           FROM "public"."vw_exposicion_cliente") AS "max_pct_cliente",
    ( SELECT "vw_exposicion_cliente"."razon_social"
           FROM "public"."vw_exposicion_cliente"
         LIMIT 1) AS "cliente_top",
    ( SELECT "max"("vw_exposicion_banco"."pct") AS "max"
           FROM "public"."vw_exposicion_banco") AS "max_pct_banco",
    ( SELECT "vw_exposicion_banco"."banco"
           FROM "public"."vw_exposicion_banco"
         LIMIT 1) AS "banco_top";


ALTER VIEW "public"."vw_concentracion_resumen" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_facturacion_cheques" AS
 SELECT "c"."id",
    "c"."convenio_id",
    COALESCE("co"."razon_social", '—'::"text") AS "convenio",
    COALESCE("cl"."razon_social", '—'::"text") AS "cliente",
    "c"."numero_cheque",
    "c"."librador",
    "c"."estado",
    "c"."monto",
    "c"."fee_calculado" AS "fee_bruto",
    "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2) AS "costo_procesamiento",
        CASE
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN COALESCE("c"."gasto_bancario", (0)::numeric)
            ELSE (0)::numeric
        END AS "multa_banco",
    (("c"."fee_calculado" - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2)) -
        CASE
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN COALESCE("c"."gasto_bancario", (0)::numeric)
            ELSE (0)::numeric
        END) AS "neto",
        CASE
            WHEN ("c"."estado" = 'procesado'::"public"."estado_cheque") THEN "c"."fecha_estimada_acred"
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN (("c"."fecha_resolucion" AT TIME ZONE 'America/Argentina/Buenos_Aires'::"text"))::"date"
            ELSE NULL::"date"
        END AS "fecha_facturacion"
   FROM ((("public"."cheques" "c"
     LEFT JOIN "public"."convenios" "co" ON (("co"."id" = "c"."convenio_id")))
     LEFT JOIN "public"."clientes" "cl" ON (("cl"."id" = "c"."cliente_id")))
     LEFT JOIN "public"."cuentas_bancarias_empresa" "cb" ON (("cb"."id" = "c"."cuenta_bancaria_id")))
  WHERE ("c"."estado" = ANY (ARRAY['procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"]));


ALTER VIEW "public"."vw_facturacion_cheques" OWNER TO "postgres";


COMMENT ON VIEW "public"."vw_facturacion_cheques" IS 'Base de facturacion por convenio. Neto = fee - costo de procesamiento (pct de la cuenta) - multa del banco en rechazados. La multa al cliente es resarcimiento y NO se factura. Acreditados se imputan por fecha de acreditacion estimada; rechazados por la fecha del rechazo en hora argentina.';



CREATE OR REPLACE VIEW "public"."vw_ganancias" AS
 SELECT "c"."cliente_id",
    ("date_trunc"('month'::"text", (COALESCE("c"."fecha_resolucion", "c"."updated_at") AT TIME ZONE 'America/Argentina/Buenos_Aires'::"text")))::"date" AS "mes",
    "sum"(("c"."fee_calculado" - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))) FILTER (WHERE ("c"."estado" = 'procesado'::"public"."estado_cheque")) AS "ganancia_procesados",
    "sum"(((("c"."fee_calculado" + "c"."multa") - "c"."gasto_bancario") - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))) FILTER (WHERE ("c"."estado" = 'rechazado'::"public"."estado_cheque")) AS "ganancia_rechazados",
    "sum"(
        CASE
            WHEN ("c"."estado" = 'procesado'::"public"."estado_cheque") THEN ("c"."fee_calculado" - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN ((("c"."fee_calculado" + "c"."multa") - "c"."gasto_bancario") - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))
            ELSE (0)::numeric
        END) FILTER (WHERE ("c"."estado" = ANY (ARRAY['procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"]))) AS "ganancia_total"
   FROM ("public"."cheques" "c"
     LEFT JOIN "public"."cuentas_bancarias_empresa" "cb" ON (("cb"."id" = "c"."cuenta_bancaria_id")))
  GROUP BY "c"."cliente_id", ("date_trunc"('month'::"text", (COALESCE("c"."fecha_resolucion", "c"."updated_at") AT TIME ZONE 'America/Argentina/Buenos_Aires'::"text")));


ALTER VIEW "public"."vw_ganancias" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_kpi_clientes" AS
SELECT
    NULL::"uuid" AS "cliente_id",
    NULL::"text" AS "razon_social",
    NULL::bigint AS "total_cheques",
    NULL::numeric AS "monto_total",
    NULL::bigint AS "cheques_rechazados",
    NULL::numeric AS "pct_rechazo",
    NULL::numeric AS "monto_rechazado";


ALTER VIEW "public"."vw_kpi_clientes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_libradores_stats" AS
 SELECT "cuit_librador",
    "max"("librador") AS "librador",
    "count"(*) AS "total_cheques",
    "sum"("monto") AS "monto_total_gestionado",
    "count"(*) FILTER (WHERE ("estado" = 'rechazado'::"public"."estado_cheque")) AS "cheques_rechazados",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("estado" = 'rechazado'::"public"."estado_cheque")))::numeric) / ("count"(*))::numeric), 2) AS "pct_rechazo",
    "max"("updated_at") FILTER (WHERE ("estado" = 'rechazado'::"public"."estado_cheque")) AS "fecha_ultimo_rechazo",
    "max"("monto") FILTER (WHERE ("estado" = 'rechazado'::"public"."estado_cheque")) AS "mayor_monto_rechazado",
    "sum"("monto") FILTER (WHERE ("created_at" >= ("now"() - '30 days'::interval))) AS "monto_ultimos_30d",
    "bool_or"("alerta_lista_negra") AS "en_lista_negra"
   FROM "public"."cheques"
  GROUP BY "cuit_librador";


ALTER VIEW "public"."vw_libradores_stats" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_libradores_score" AS
 SELECT "cuit_librador",
    "librador",
    "total_cheques",
    "monto_total_gestionado",
    "cheques_rechazados",
    "pct_rechazo",
    "fecha_ultimo_rechazo",
    "mayor_monto_rechazado",
    "monto_ultimos_30d",
    "en_lista_negra",
        CASE
            WHEN "en_lista_negra" THEN 100
            ELSE LEAST(100, GREATEST(0, ("round"((((((("cheques_rechazados")::numeric + ((5)::numeric * 0.08)) / (("total_cheques")::numeric + (5)::numeric)) * (100)::numeric) * 0.75) +
            CASE
                WHEN ("fecha_ultimo_rechazo" IS NULL) THEN (0)::numeric
                ELSE ((25)::numeric * "exp"(((('-1'::integer)::numeric * EXTRACT(epoch FROM ("now"() - "fecha_ultimo_rechazo"))) / (86400.0 * (180)::numeric))))
            END)))::integer))
        END AS "score_riesgo",
        CASE
            WHEN "en_lista_negra" THEN 'critico'::"text"
            WHEN (("cheques_rechazados" = 0) AND ("total_cheques" <= 1)) THEN 'sin_historial'::"text"
            ELSE
            CASE
                WHEN (
                CASE
                    WHEN "en_lista_negra" THEN 100
                    ELSE LEAST(100, GREATEST(0, ("round"((((((("cheques_rechazados")::numeric + ((5)::numeric * 0.08)) / (("total_cheques")::numeric + (5)::numeric)) * (100)::numeric) * 0.75) +
                    CASE
                        WHEN ("fecha_ultimo_rechazo" IS NULL) THEN (0)::numeric
                        ELSE ((25)::numeric * "exp"(((('-1'::integer)::numeric * EXTRACT(epoch FROM ("now"() - "fecha_ultimo_rechazo"))) / (86400.0 * (180)::numeric))))
                    END)))::integer))
                END >= 86) THEN 'critico'::"text"
                WHEN (
                CASE
                    WHEN "en_lista_negra" THEN 100
                    ELSE LEAST(100, GREATEST(0, ("round"((((((("cheques_rechazados")::numeric + ((5)::numeric * 0.08)) / (("total_cheques")::numeric + (5)::numeric)) * (100)::numeric) * 0.75) +
                    CASE
                        WHEN ("fecha_ultimo_rechazo" IS NULL) THEN (0)::numeric
                        ELSE ((25)::numeric * "exp"(((('-1'::integer)::numeric * EXTRACT(epoch FROM ("now"() - "fecha_ultimo_rechazo"))) / (86400.0 * (180)::numeric))))
                    END)))::integer))
                END >= 61) THEN 'alto'::"text"
                WHEN (
                CASE
                    WHEN "en_lista_negra" THEN 100
                    ELSE LEAST(100, GREATEST(0, ("round"((((((("cheques_rechazados")::numeric + ((5)::numeric * 0.08)) / (("total_cheques")::numeric + (5)::numeric)) * (100)::numeric) * 0.75) +
                    CASE
                        WHEN ("fecha_ultimo_rechazo" IS NULL) THEN (0)::numeric
                        ELSE ((25)::numeric * "exp"(((('-1'::integer)::numeric * EXTRACT(epoch FROM ("now"() - "fecha_ultimo_rechazo"))) / (86400.0 * (180)::numeric))))
                    END)))::integer))
                END >= 31) THEN 'medio'::"text"
                ELSE 'bajo'::"text"
            END
        END AS "banda_riesgo"
   FROM "public"."vw_libradores_stats" "s";


ALTER VIEW "public"."vw_libradores_score" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_metricas_ganancia" AS
 SELECT COALESCE("sum"(
        CASE
            WHEN ("c"."estado" = 'procesado'::"public"."estado_cheque") THEN ("c"."fee_calculado" - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))
            ELSE NULL::numeric
        END), (0)::numeric) AS "comision_acreditados",
    COALESCE("sum"(
        CASE
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN ("c"."fee_calculado" - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))
            ELSE NULL::numeric
        END), (0)::numeric) AS "comision_rechazados",
    COALESCE("sum"(
        CASE
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN ("c"."multa" - "c"."gasto_bancario")
            ELSE NULL::numeric
        END), (0)::numeric) AS "margen_multas",
    COALESCE("sum"(
        CASE
            WHEN ("c"."estado" = 'procesado'::"public"."estado_cheque") THEN ("c"."fee_calculado" - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))
            WHEN ("c"."estado" = 'rechazado'::"public"."estado_cheque") THEN ((("c"."fee_calculado" + "c"."multa") - "c"."gasto_bancario") - "round"((("c"."monto" * COALESCE("cb"."costo_bancario_pct", (0)::numeric)) / (100)::numeric), 2))
            ELSE (0)::numeric
        END), (0)::numeric) AS "ganancia_total"
   FROM ("public"."cheques" "c"
     LEFT JOIN "public"."cuentas_bancarias_empresa" "cb" ON (("cb"."id" = "c"."cuenta_bancaria_id")));


ALTER VIEW "public"."vw_metricas_ganancia" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_metricas_general" AS
 SELECT "count"(*) AS "cargados_cant",
    COALESCE("sum"("monto"), (0)::numeric) AS "cargados_importe",
    "count"(*) FILTER (WHERE ("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"]))) AS "enviados_cant",
    COALESCE("sum"("monto") FILTER (WHERE ("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"]))), (0)::numeric) AS "enviados_importe",
    "count"(*) FILTER (WHERE (("estado" = 'aceptado'::"public"."estado_cheque") OR (("estado" = 'en_custodia'::"public"."estado_cheque") AND ("fecha_cobro" <= "public"."fn_hoy"())))) AS "cartera_cant",
    COALESCE("sum"("monto") FILTER (WHERE (("estado" = 'aceptado'::"public"."estado_cheque") OR (("estado" = 'en_custodia'::"public"."estado_cheque") AND ("fecha_cobro" <= "public"."fn_hoy"())))), (0)::numeric) AS "cartera_importe",
    "count"(*) FILTER (WHERE (("estado" = 'en_custodia'::"public"."estado_cheque") AND ("fecha_cobro" > "public"."fn_hoy"()))) AS "custodia_cant",
    COALESCE("sum"("monto") FILTER (WHERE (("estado" = 'en_custodia'::"public"."estado_cheque") AND ("fecha_cobro" > "public"."fn_hoy"()))), (0)::numeric) AS "custodia_importe",
    "count"(*) FILTER (WHERE ("estado" = 'procesado'::"public"."estado_cheque")) AS "acreditados_cant",
    COALESCE("sum"("monto") FILTER (WHERE ("estado" = 'procesado'::"public"."estado_cheque")), (0)::numeric) AS "acreditados_importe",
    "count"(*) FILTER (WHERE ("estado" = 'rechazado'::"public"."estado_cheque")) AS "rechazados_cant",
    COALESCE("sum"("monto") FILTER (WHERE ("estado" = 'rechazado'::"public"."estado_cheque")), (0)::numeric) AS "rechazados_importe",
    "count"(*) FILTER (WHERE ("estado" = 'depositado'::"public"."estado_cheque")) AS "clearing_cant",
    COALESCE("sum"("monto") FILTER (WHERE ("estado" = 'depositado'::"public"."estado_cheque")), (0)::numeric) AS "clearing_importe",
    "count"(*) FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("plaza" = 'camara'::"text"))) AS "camara_cant",
    COALESCE("sum"("monto") FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("plaza" = 'camara'::"text"))), (0)::numeric) AS "camara_importe",
    "count"(*) FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("plaza" = 'interior'::"text"))) AS "interior_cant",
    COALESCE("sum"("monto") FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("plaza" = 'interior'::"text"))), (0)::numeric) AS "interior_importe",
    "count"(*) FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("tipo" = 'fisico'::"public"."tipo_cheque"))) AS "fisico_cant",
    COALESCE("sum"("monto") FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("tipo" = 'fisico'::"public"."tipo_cheque"))), (0)::numeric) AS "fisico_importe",
    "count"(*) FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("tipo" = 'echeq'::"public"."tipo_cheque"))) AS "echeq_cant",
    COALESCE("sum"("monto") FILTER (WHERE (("estado" = ANY (ARRAY['depositado'::"public"."estado_cheque", 'procesado'::"public"."estado_cheque", 'rechazado'::"public"."estado_cheque"])) AND ("tipo" = 'echeq'::"public"."tipo_cheque"))), (0)::numeric) AS "echeq_importe"
   FROM "public"."cheques";


ALTER VIEW "public"."vw_metricas_general" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_pendiente_liquidar" AS
 SELECT "cliente_id",
    "sum"("monto") AS "total_procesado",
    "sum"(("monto" - "fee_calculado")) AS "neto_a_liquidar",
    "count"(*) AS "cantidad_cheques"
   FROM "public"."cheques"
  WHERE ("estado" = 'procesado'::"public"."estado_cheque")
  GROUP BY "cliente_id";


ALTER VIEW "public"."vw_pendiente_liquidar" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_plaft_liquidaciones" AS
 SELECT "l"."id",
    "l"."cliente_id",
    "cl"."razon_social" AS "cliente",
    "l"."fecha_transferencia",
    "l"."created_at",
    "l"."monto_liquidado",
    "regexp_replace"(COALESCE("l"."cvu_cbu_destino", ''::"text"), '\D'::"text", ''::"text", 'g'::"text") AS "destino_cbu",
    NULLIF(TRIM(BOTH FROM COALESCE("l"."beneficiario", ''::"text")), ''::"text") AS "beneficiario",
    "regexp_replace"(COALESCE("l"."cuit_beneficiario", ''::"text"), '\D'::"text", ''::"text", 'g'::"text") AS "cuit_destino",
        CASE
            WHEN ("left"("regexp_replace"(COALESCE("l"."cuit_beneficiario", ''::"text"), '\D'::"text", ''::"text", 'g'::"text"), 2) = ANY (ARRAY['20'::"text", '23'::"text", '24'::"text", '25'::"text", '26'::"text", '27'::"text"])) THEN 'fisica'::"text"
            WHEN ("left"("regexp_replace"(COALESCE("l"."cuit_beneficiario", ''::"text"), '\D'::"text", ''::"text", 'g'::"text"), 2) = ANY (ARRAY['30'::"text", '33'::"text", '34'::"text"])) THEN 'juridica'::"text"
            ELSE 'desconocido'::"text"
        END AS "tipo_persona_destino"
   FROM ("public"."liquidaciones" "l"
     JOIN "public"."clientes" "cl" ON (("cl"."id" = "l"."cliente_id")));


ALTER VIEW "public"."vw_plaft_liquidaciones" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_plaft_cliente_destino" AS
 WITH "tot_cliente" AS (
         SELECT "vw_plaft_liquidaciones"."cliente_id",
            "sum"("vw_plaft_liquidaciones"."monto_liquidado") AS "total_cliente"
           FROM "public"."vw_plaft_liquidaciones"
          GROUP BY "vw_plaft_liquidaciones"."cliente_id"
        )
 SELECT "v"."cliente_id",
    "v"."cliente",
    "v"."destino_cbu",
    "max"("v"."beneficiario") AS "beneficiario",
    "max"("v"."cuit_destino") AS "cuit_destino",
    "max"("v"."tipo_persona_destino") AS "tipo_persona",
    "count"(*) AS "transferencias",
    "sum"("v"."monto_liquidado") AS "monto",
    "round"(((100.0 * "sum"("v"."monto_liquidado")) / NULLIF("t"."total_cliente", (0)::numeric)), 2) AS "pct_del_cliente"
   FROM ("public"."vw_plaft_liquidaciones" "v"
     JOIN "tot_cliente" "t" ON (("t"."cliente_id" = "v"."cliente_id")))
  WHERE ("v"."destino_cbu" <> ''::"text")
  GROUP BY "v"."cliente_id", "v"."cliente", "v"."destino_cbu", "t"."total_cliente";


ALTER VIEW "public"."vw_plaft_cliente_destino" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_plaft_destino_mes_actual" AS
 SELECT "destino_cbu",
    "max"("beneficiario") AS "beneficiario",
    "max"("cuit_destino") AS "cuit_destino",
    "max"("tipo_persona_destino") AS "tipo_persona",
    "count"(*) AS "transferencias_mes",
    "sum"("monto_liquidado") AS "acumulado_mes",
    "count"(DISTINCT "cliente_id") AS "clientes_mes"
   FROM "public"."vw_plaft_liquidaciones"
  WHERE ("date_trunc"('month'::"text", ("fecha_transferencia")::timestamp with time zone) = "date_trunc"('month'::"text", ("public"."fn_hoy"())::timestamp with time zone))
  GROUP BY "destino_cbu";


ALTER VIEW "public"."vw_plaft_destino_mes_actual" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_plaft_destinos" AS
 SELECT "destino_cbu",
    "max"("beneficiario") AS "beneficiario",
    "max"("cuit_destino") AS "cuit_destino",
    "max"("tipo_persona_destino") AS "tipo_persona",
    "count"(DISTINCT "cliente_id") AS "clientes_distintos",
    "count"(*) AS "transferencias",
    "sum"("monto_liquidado") AS "total_recibido",
    "min"("fecha_transferencia") AS "primera",
    "max"("fecha_transferencia") AS "ultima"
   FROM "public"."vw_plaft_liquidaciones"
  WHERE ("destino_cbu" <> ''::"text")
  GROUP BY "destino_cbu";


ALTER VIEW "public"."vw_plaft_destinos" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_plaft_score_cliente" AS
 SELECT "cliente_id",
    "cliente",
    "transferencias",
    "total_liquidado",
    "destinos",
    "max_concentracion_pct",
    "destinos_compartidos",
    "total_a_fisicas",
    "episodios_fraccionamiento",
    "score_plaft",
        CASE
            WHEN ("score_plaft" >= 71) THEN 'critico'::"text"
            WHEN ("score_plaft" >= 46) THEN 'alerta'::"text"
            WHEN ("score_plaft" >= 21) THEN 'observacion'::"text"
            ELSE 'normal'::"text"
        END AS "banda_plaft"
   FROM ( WITH "base" AS (
                 SELECT "vw_plaft_liquidaciones"."id",
                    "vw_plaft_liquidaciones"."cliente_id",
                    "vw_plaft_liquidaciones"."cliente",
                    "vw_plaft_liquidaciones"."fecha_transferencia",
                    "vw_plaft_liquidaciones"."created_at",
                    "vw_plaft_liquidaciones"."monto_liquidado",
                    "vw_plaft_liquidaciones"."destino_cbu",
                    "vw_plaft_liquidaciones"."beneficiario",
                    "vw_plaft_liquidaciones"."cuit_destino",
                    "vw_plaft_liquidaciones"."tipo_persona_destino"
                   FROM "public"."vw_plaft_liquidaciones"
                  WHERE ("vw_plaft_liquidaciones"."destino_cbu" <> ''::"text")
                ), "tot" AS (
                 SELECT "base"."cliente_id",
                    "base"."cliente",
                    "count"(*) AS "transferencias",
                    "sum"("base"."monto_liquidado") AS "total_liquidado",
                    "count"(DISTINCT "base"."destino_cbu") AS "destinos"
                   FROM "base"
                  GROUP BY "base"."cliente_id", "base"."cliente"
                ), "conc" AS (
                 SELECT "vw_plaft_cliente_destino"."cliente_id",
                    "max"("vw_plaft_cliente_destino"."pct_del_cliente") AS "max_pct"
                   FROM "public"."vw_plaft_cliente_destino"
                  WHERE ("vw_plaft_cliente_destino"."monto" > (10000000)::numeric)
                  GROUP BY "vw_plaft_cliente_destino"."cliente_id"
                ), "comp" AS (
                 SELECT "b"."cliente_id",
                    "count"(DISTINCT "b"."destino_cbu") AS "destinos_compartidos"
                   FROM (( SELECT DISTINCT "base"."cliente_id",
                            "base"."destino_cbu"
                           FROM "base") "b"
                     JOIN "public"."vw_plaft_destinos" "d" ON (("d"."destino_cbu" = "b"."destino_cbu")))
                  WHERE ("d"."clientes_distintos" >= 2)
                  GROUP BY "b"."cliente_id"
                ), "fis" AS (
                 SELECT "base"."cliente_id",
                    "sum"("base"."monto_liquidado") AS "total_fisica"
                   FROM "base"
                  WHERE ("base"."tipo_persona_destino" = 'fisica'::"text")
                  GROUP BY "base"."cliente_id"
                ), "frac" AS (
                 SELECT "x"."cliente_id",
                    "count"(*) AS "episodios_fracc"
                   FROM ( SELECT "base"."cliente_id",
                            "base"."destino_cbu",
                            "base"."fecha_transferencia"
                           FROM "base"
                          GROUP BY "base"."cliente_id", "base"."destino_cbu", "base"."fecha_transferencia"
                         HAVING (("count"(*) >= 2) AND ("sum"("base"."monto_liquidado") > (10000000)::numeric))) "x"
                  GROUP BY "x"."cliente_id"
                )
         SELECT "t"."cliente_id",
            "t"."cliente",
            "t"."transferencias",
            "t"."total_liquidado",
            "t"."destinos",
            COALESCE("c"."max_pct", (0)::numeric) AS "max_concentracion_pct",
            COALESCE("co"."destinos_compartidos", (0)::bigint) AS "destinos_compartidos",
            COALESCE("f"."total_fisica", (0)::numeric) AS "total_a_fisicas",
            COALESCE("fr"."episodios_fracc", (0)::bigint) AS "episodios_fraccionamiento",
            LEAST(100, (((
                CASE
                    WHEN (COALESCE("c"."max_pct", (0)::numeric) >= (50)::numeric) THEN 30
                    WHEN (COALESCE("c"."max_pct", (0)::numeric) >= (30)::numeric) THEN 20
                    WHEN (COALESCE("c"."max_pct", (0)::numeric) >= (15)::numeric) THEN 10
                    ELSE 0
                END +
                CASE
                    WHEN (COALESCE("co"."destinos_compartidos", (0)::bigint) >= 3) THEN 25
                    WHEN (COALESCE("co"."destinos_compartidos", (0)::bigint) = 2) THEN 15
                    WHEN (COALESCE("co"."destinos_compartidos", (0)::bigint) = 1) THEN 8
                    ELSE 0
                END) +
                CASE
                    WHEN (COALESCE("f"."total_fisica", (0)::numeric) >= (20000000)::numeric) THEN 25
                    WHEN (COALESCE("f"."total_fisica", (0)::numeric) >= (5000000)::numeric) THEN 15
                    WHEN (COALESCE("f"."total_fisica", (0)::numeric) > (0)::numeric) THEN 5
                    ELSE 0
                END) +
                CASE
                    WHEN (COALESCE("fr"."episodios_fracc", (0)::bigint) >= 3) THEN 20
                    WHEN (COALESCE("fr"."episodios_fracc", (0)::bigint) >= 1) THEN 12
                    ELSE 0
                END)) AS "score_plaft"
           FROM (((("tot" "t"
             LEFT JOIN "conc" "c" USING ("cliente_id"))
             LEFT JOIN "comp" "co" USING ("cliente_id"))
             LEFT JOIN "fis" "f" USING ("cliente_id"))
             LEFT JOIN "frac" "fr" USING ("cliente_id"))) "s";


ALTER VIEW "public"."vw_plaft_score_cliente" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_proyeccion_acreditaciones" AS
 SELECT "fecha_estimada_acred" AS "dia",
    "count"(*) AS "cheques",
    "sum"("monto") AS "monto"
   FROM "public"."cheques"
  WHERE (("estado" = 'depositado'::"public"."estado_cheque") AND ("fecha_estimada_acred" IS NOT NULL) AND ("fecha_estimada_acred" >= "public"."fn_hoy"()) AND ("fecha_estimada_acred" <= ("public"."fn_hoy"() + 30)))
  GROUP BY "fecha_estimada_acred"
  ORDER BY "fecha_estimada_acred";


ALTER VIEW "public"."vw_proyeccion_acreditaciones" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_saldos_clientes" AS
SELECT
    NULL::"uuid" AS "cliente_id",
    NULL::"text" AS "razon_social",
    NULL::"text" AS "cuit",
    NULL::"text" AS "email",
    NULL::numeric(5,3) AS "fee_porcentaje",
    NULL::numeric AS "saldo_disponible";


ALTER VIEW "public"."vw_saldos_clientes" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."vw_tendencia_cliente" AS
 WITH "meses" AS (
         SELECT "to_char"("date_trunc"('month'::"text", "d"."d"), 'YYYY-MM'::"text") AS "mes"
           FROM "generate_series"(("date_trunc"('month'::"text", "now"()) - '5 mons'::interval), "date_trunc"('month'::"text", "now"()), '1 mon'::interval) "d"("d")
        ), "clientes_activos" AS (
         SELECT "clientes"."id" AS "cliente_id"
           FROM "public"."clientes"
        ), "base" AS (
         SELECT "cl"."cliente_id",
            "m"."mes",
            COALESCE("sum"("c"."monto") FILTER (WHERE ("c"."estado" = ANY (ARRAY['procesado'::"public"."estado_cheque", 'depositado'::"public"."estado_cheque", 'aceptado'::"public"."estado_cheque", 'en_custodia'::"public"."estado_cheque"]))), (0)::numeric) AS "volumen"
           FROM (("clientes_activos" "cl"
             CROSS JOIN "meses" "m")
             LEFT JOIN "public"."cheques" "c" ON ((("c"."cliente_id" = "cl"."cliente_id") AND ("to_char"("date_trunc"('month'::"text", "c"."created_at"), 'YYYY-MM'::"text") = "m"."mes"))))
          GROUP BY "cl"."cliente_id", "m"."mes"
        )
 SELECT "cliente_id",
    "array_agg"("volumen" ORDER BY "mes") AS "serie_volumen"
   FROM "base"
  GROUP BY "cliente_id";


ALTER VIEW "public"."vw_tendencia_cliente" OWNER TO "postgres";


ALTER TABLE ONLY "public"."bancos" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."bancos_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."bancos"
    ADD CONSTRAINT "bancos_nombre_key" UNIQUE ("nombre");



ALTER TABLE ONLY "public"."bancos"
    ADD CONSTRAINT "bancos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_echeq_id_key" UNIQUE ("echeq_id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."cheques"
    ADD CONSTRAINT "chk_cheques_fechas_rango" CHECK (((("fecha_cobro" >= '2000-01-01'::"date") AND ("fecha_cobro" <= '2100-01-01'::"date")) AND (("fecha_pago" IS NULL) OR (("fecha_pago" >= '2000-01-01'::"date") AND ("fecha_pago" <= '2100-01-01'::"date"))) AND (("fecha_deposito" IS NULL) OR (("fecha_deposito" >= '2000-01-01'::"date") AND ("fecha_deposito" <= '2100-01-01'::"date"))) AND (("fecha_carga" IS NULL) OR (("fecha_carga" >= '2000-01-01'::"date") AND ("fecha_carga" <= '2100-01-01'::"date"))))) NOT VALID;



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_cuit_key" UNIQUE ("cuit");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_portal_token_key" UNIQUE ("portal_token");



ALTER TABLE ONLY "public"."convenios"
    ADD CONSTRAINT "convenios_cuit_key" UNIQUE ("cuit");



ALTER TABLE ONLY "public"."convenios"
    ADD CONSTRAINT "convenios_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuentas_bancarias_empresa"
    ADD CONSTRAINT "cuentas_bancarias_empresa_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cuits_destino_bloqueados"
    ADD CONSTRAINT "cuits_destino_bloqueados_pkey" PRIMARY KEY ("cuit");



ALTER TABLE ONLY "public"."feriados"
    ADD CONSTRAINT "feriados_pkey" PRIMARY KEY ("fecha");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lista_negra_libradores"
    ADD CONSTRAINT "lista_negra_libradores_cuit_key" UNIQUE ("cuit");



ALTER TABLE ONLY "public"."lista_negra_libradores"
    ADD CONSTRAINT "lista_negra_libradores_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."logs_auditoria"
    ADD CONSTRAINT "logs_auditoria_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_unico" UNIQUE ("cliente_id", "fecha", "numero");



ALTER TABLE ONLY "public"."movimientos_clientes"
    ADD CONSTRAINT "movimientos_clientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones_pendientes"
    ADD CONSTRAINT "notificaciones_pendientes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."plaft_parametros"
    ADD CONSTRAINT "plaft_parametros_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recibos_devolucion_items"
    ADD CONSTRAINT "recibos_devolucion_items_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recibos_devolucion"
    ADD CONSTRAINT "recibos_devolucion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."recibos_devolucion"
    ADD CONSTRAINT "recibos_numero_unico" UNIQUE ("numero");



ALTER TABLE ONLY "public"."solicitudes_liquidacion"
    ADD CONSTRAINT "solicitudes_liquidacion_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "uq_cheque_numero_librador" UNIQUE ("numero_cheque", "cuit_librador");



CREATE INDEX "idx_cheques_cliente" ON "public"."cheques" USING "btree" ("cliente_id");



CREATE INDEX "idx_cheques_created_at" ON "public"."cheques" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_cheques_cuit_librador" ON "public"."cheques" USING "btree" ("cuit_librador");



CREATE INDEX "idx_cheques_estado" ON "public"."cheques" USING "btree" ("estado");



CREATE INDEX "idx_cheques_fecha_cobro" ON "public"."cheques" USING "btree" ("fecha_cobro");



CREATE INDEX "idx_cheques_fechas" ON "public"."cheques" USING "btree" ("fecha_deposito", "fecha_estimada_acred");



CREATE UNIQUE INDEX "idx_cheques_foto_unica" ON "public"."cheques" USING "btree" ("lote_id", "foto_numero") WHERE (("lote_id" IS NOT NULL) AND ("foto_numero" IS NOT NULL));



CREATE INDEX "idx_cheques_librador" ON "public"."cheques" USING "btree" ("cuit_librador");



CREATE INDEX "idx_cheques_lote" ON "public"."cheques" USING "btree" ("lote_id");



CREATE INDEX "idx_cheques_recibo" ON "public"."cheques" USING "btree" ("recibo_id");



CREATE INDEX "idx_liq_cliente" ON "public"."liquidaciones" USING "btree" ("cliente_id");



CREATE INDEX "idx_liq_created_at" ON "public"."liquidaciones" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_liq_cuit_benef" ON "public"."liquidaciones" USING "btree" ("cuit_beneficiario");



CREATE INDEX "idx_logs_created_at" ON "public"."logs_auditoria" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_logs_registro" ON "public"."logs_auditoria" USING "btree" ("tabla", "registro_id");



CREATE INDEX "idx_logs_tabla" ON "public"."logs_auditoria" USING "btree" ("tabla");



CREATE INDEX "idx_lotes_cliente_fecha" ON "public"."lotes" USING "btree" ("cliente_id", "fecha");



CREATE UNIQUE INDEX "idx_lotes_uno_abierto_por_usuario" ON "public"."lotes" USING "btree" ("abierto_por") WHERE ("estado" = 'abierto'::"text");



CREATE INDEX "idx_mov_cheque" ON "public"."movimientos_clientes" USING "btree" ("cheque_id");



CREATE INDEX "idx_mov_cliente" ON "public"."movimientos_clientes" USING "btree" ("cliente_id");



CREATE INDEX "idx_mov_liquidacion" ON "public"."movimientos_clientes" USING "btree" ("liquidacion_id");



CREATE INDEX "idx_movimientos_cliente" ON "public"."movimientos_clientes" USING "btree" ("cliente_id");



CREATE INDEX "idx_recibo_items_cheque" ON "public"."recibos_devolucion_items" USING "btree" ("cheque_id");



CREATE INDEX "idx_recibo_items_recibo" ON "public"."recibos_devolucion_items" USING "btree" ("recibo_id");



CREATE INDEX "idx_sol_cliente" ON "public"."solicitudes_liquidacion" USING "btree" ("cliente_id");



CREATE INDEX "idx_sol_estado" ON "public"."solicitudes_liquidacion" USING "btree" ("estado");



CREATE OR REPLACE VIEW "public"."vw_kpi_clientes" AS
 SELECT "cl"."id" AS "cliente_id",
    "cl"."razon_social",
    "count"("ch"."id") AS "total_cheques",
    "sum"("ch"."monto") AS "monto_total",
    "count"(*) FILTER (WHERE ("ch"."estado" = 'rechazado'::"public"."estado_cheque")) AS "cheques_rechazados",
    "round"(((100.0 * ("count"(*) FILTER (WHERE ("ch"."estado" = 'rechazado'::"public"."estado_cheque")))::numeric) / (NULLIF("count"("ch"."id"), 0))::numeric), 2) AS "pct_rechazo",
    "sum"("ch"."monto") FILTER (WHERE ("ch"."estado" = 'rechazado'::"public"."estado_cheque")) AS "monto_rechazado"
   FROM ("public"."clientes" "cl"
     LEFT JOIN "public"."cheques" "ch" ON (("ch"."cliente_id" = "cl"."id")))
  GROUP BY "cl"."id";



CREATE OR REPLACE VIEW "public"."vw_saldos_clientes" AS
 SELECT "c"."id" AS "cliente_id",
    "c"."razon_social",
    "c"."cuit",
    "c"."email",
    "c"."fee_porcentaje",
    COALESCE("sum"("m"."monto"), (0)::numeric) AS "saldo_disponible"
   FROM ("public"."clientes" "c"
     LEFT JOIN "public"."movimientos_clientes" "m" ON (("m"."cliente_id" = "c"."id")))
  GROUP BY "c"."id";



CREATE OR REPLACE TRIGGER "trg_audit_cheques" AFTER INSERT OR DELETE OR UPDATE ON "public"."cheques" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "trg_audit_clientes" AFTER INSERT OR DELETE OR UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "trg_audit_liquidaciones" AFTER INSERT OR DELETE OR UPDATE ON "public"."liquidaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "trg_audit_movimientos" AFTER INSERT OR DELETE OR UPDATE ON "public"."movimientos_clientes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_auditar"();



CREATE OR REPLACE TRIGGER "trg_cheques_after_update" AFTER UPDATE ON "public"."cheques" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cheques_after_update"();



CREATE OR REPLACE TRIGGER "trg_cheques_before_insert" BEFORE INSERT ON "public"."cheques" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cheques_before_insert"();



CREATE OR REPLACE TRIGGER "trg_cheques_before_update" BEFORE UPDATE ON "public"."cheques" FOR EACH ROW EXECUTE FUNCTION "public"."fn_cheques_before_update"();



CREATE OR REPLACE TRIGGER "trg_fecha_resolucion" BEFORE UPDATE ON "public"."cheques" FOR EACH ROW EXECUTE FUNCTION "public"."fn_marcar_resolucion"();



CREATE OR REPLACE TRIGGER "trg_liquidaciones_after_insert" AFTER INSERT ON "public"."liquidaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_liquidaciones_after_insert"();



CREATE OR REPLACE TRIGGER "trg_logs_inmutables" BEFORE DELETE OR UPDATE ON "public"."logs_auditoria" FOR EACH ROW EXECUTE FUNCTION "public"."fn_logs_inmutables"();



CREATE OR REPLACE TRIGGER "trg_notif_solicitud" AFTER INSERT ON "public"."solicitudes_liquidacion" FOR EACH ROW EXECUTE FUNCTION "public"."fn_notif_solicitud"();



CREATE OR REPLACE TRIGGER "trg_proteger_fee" BEFORE UPDATE ON "public"."clientes" FOR EACH ROW EXECUTE FUNCTION "public"."fn_proteger_fee_cliente"();



CREATE OR REPLACE TRIGGER "trg_validar_liquidacion" BEFORE INSERT ON "public"."liquidaciones" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_liquidacion"();



CREATE OR REPLACE TRIGGER "trg_validar_solicitud" BEFORE INSERT ON "public"."solicitudes_liquidacion" FOR EACH ROW EXECUTE FUNCTION "public"."fn_validar_solicitud"();



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_convenio_id_fkey" FOREIGN KEY ("convenio_id") REFERENCES "public"."convenios"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_cuenta_bancaria_id_fkey" FOREIGN KEY ("cuenta_bancaria_id") REFERENCES "public"."cuentas_bancarias_empresa"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_lote_id_fkey" FOREIGN KEY ("lote_id") REFERENCES "public"."lotes"("id");



ALTER TABLE ONLY "public"."cheques"
    ADD CONSTRAINT "cheques_recibo_id_fkey" FOREIGN KEY ("recibo_id") REFERENCES "public"."recibos_devolucion"("id");



ALTER TABLE ONLY "public"."clientes"
    ADD CONSTRAINT "clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."movimientos_clientes"
    ADD CONSTRAINT "fk_mov_liquidacion" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones"("id");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."liquidaciones"
    ADD CONSTRAINT "liquidaciones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."lista_negra_libradores"
    ADD CONSTRAINT "lista_negra_libradores_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."lotes"
    ADD CONSTRAINT "lotes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."movimientos_clientes"
    ADD CONSTRAINT "movimientos_clientes_cheque_id_fkey" FOREIGN KEY ("cheque_id") REFERENCES "public"."cheques"("id");



ALTER TABLE ONLY "public"."movimientos_clientes"
    ADD CONSTRAINT "movimientos_clientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."movimientos_clientes"
    ADD CONSTRAINT "movimientos_clientes_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "public"."perfiles"("id");



ALTER TABLE ONLY "public"."notificaciones"
    ADD CONSTRAINT "notificaciones_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."notificaciones_pendientes"
    ADD CONSTRAINT "notificaciones_pendientes_cheque_id_fkey" FOREIGN KEY ("cheque_id") REFERENCES "public"."cheques"("id");



ALTER TABLE ONLY "public"."notificaciones_pendientes"
    ADD CONSTRAINT "notificaciones_pendientes_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."perfiles"
    ADD CONSTRAINT "perfiles_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."recibos_devolucion"
    ADD CONSTRAINT "recibos_devolucion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."recibos_devolucion_items"
    ADD CONSTRAINT "recibos_devolucion_items_cheque_id_fkey" FOREIGN KEY ("cheque_id") REFERENCES "public"."cheques"("id");



ALTER TABLE ONLY "public"."recibos_devolucion_items"
    ADD CONSTRAINT "recibos_devolucion_items_recibo_id_fkey" FOREIGN KEY ("recibo_id") REFERENCES "public"."recibos_devolucion"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."solicitudes_liquidacion"
    ADD CONSTRAINT "solicitudes_liquidacion_cliente_id_fkey" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id");



ALTER TABLE ONLY "public"."solicitudes_liquidacion"
    ADD CONSTRAINT "solicitudes_liquidacion_liquidacion_id_fkey" FOREIGN KEY ("liquidacion_id") REFERENCES "public"."liquidaciones"("id");



ALTER TABLE "public"."bancos" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "bancos lectura autenticados" ON "public"."bancos" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cheques" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."cheques_backup_fechas_20260723" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cheques_delete_admin" ON "public"."cheques" FOR DELETE TO "authenticated" USING ("public"."fn_es_admin"());



CREATE POLICY "cheques_insert" ON "public"."cheques" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "cheques_select" ON "public"."cheques" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cheques_update" ON "public"."cheques" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "clientes_delete_admin" ON "public"."clientes" FOR DELETE TO "authenticated" USING ("public"."fn_es_admin"());



CREATE POLICY "clientes_insert" ON "public"."clientes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "clientes_select" ON "public"."clientes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "clientes_update" ON "public"."clientes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."convenios" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "convenios_admin" ON "public"."convenios" TO "authenticated" USING ("public"."fn_es_admin"()) WITH CHECK ("public"."fn_es_admin"());



CREATE POLICY "convenios_select" ON "public"."convenios" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "cuentas_admin" ON "public"."cuentas_bancarias_empresa" TO "authenticated" USING ("public"."fn_es_admin"()) WITH CHECK ("public"."fn_es_admin"());



ALTER TABLE "public"."cuentas_bancarias_empresa" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "cuentas_select" ON "public"."cuentas_bancarias_empresa" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."cuits_destino_bloqueados" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."feriados" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "feriados_admin" ON "public"."feriados" TO "authenticated" USING ("public"."fn_es_admin"()) WITH CHECK ("public"."fn_es_admin"());



CREATE POLICY "feriados_select" ON "public"."feriados" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."liquidaciones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "liquidaciones_admin" ON "public"."liquidaciones" FOR INSERT TO "authenticated" WITH CHECK ("public"."fn_es_admin"());



CREATE POLICY "liquidaciones_select" ON "public"."liquidaciones" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."lista_negra_libradores" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "listanegra_admin" ON "public"."lista_negra_libradores" TO "authenticated" USING ("public"."fn_es_admin"()) WITH CHECK ("public"."fn_es_admin"());



CREATE POLICY "listanegra_select" ON "public"."lista_negra_libradores" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."logs_auditoria" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "logs_select" ON "public"."logs_auditoria" FOR SELECT TO "authenticated" USING (true);



ALTER TABLE "public"."lotes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "lotes_delete_admin" ON "public"."lotes" FOR DELETE TO "authenticated" USING ("public"."fn_es_admin"());



CREATE POLICY "lotes_insert" ON "public"."lotes" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "lotes_select" ON "public"."lotes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "lotes_update" ON "public"."lotes" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



ALTER TABLE "public"."movimientos_clientes" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "movimientos_insert_admin" ON "public"."movimientos_clientes" FOR INSERT TO "authenticated" WITH CHECK (("public"."fn_es_admin"() AND ("tipo" = 'ajuste_manual'::"public"."tipo_movimiento")));



CREATE POLICY "movimientos_select" ON "public"."movimientos_clientes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notif_select" ON "public"."notificaciones" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notif_select" ON "public"."notificaciones_pendientes" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "notif_update" ON "public"."notificaciones" FOR UPDATE TO "authenticated" USING (true);



ALTER TABLE "public"."notificaciones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."notificaciones_pendientes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."perfiles" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "perfiles_select" ON "public"."perfiles" FOR SELECT TO "authenticated" USING ((("id" = "auth"."uid"()) OR "public"."fn_es_admin"()));



CREATE POLICY "perfiles_update_admin" ON "public"."perfiles" FOR UPDATE TO "authenticated" USING ("public"."fn_es_admin"()) WITH CHECK ("public"."fn_es_admin"());



ALTER TABLE "public"."plaft_parametros" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "plaft_parametros lectura autenticados" ON "public"."plaft_parametros" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "recibos_delete_admin" ON "public"."recibos_devolucion" FOR DELETE TO "authenticated" USING ("public"."fn_es_admin"());



ALTER TABLE "public"."recibos_devolucion" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."recibos_devolucion_items" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "recibos_insert" ON "public"."recibos_devolucion" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "recibos_select" ON "public"."recibos_devolucion" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "recibos_update" ON "public"."recibos_devolucion" FOR UPDATE TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "ritems_insert" ON "public"."recibos_devolucion_items" FOR INSERT TO "authenticated" WITH CHECK (true);



CREATE POLICY "ritems_select" ON "public"."recibos_devolucion_items" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sol_select" ON "public"."solicitudes_liquidacion" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "sol_update_admin" ON "public"."solicitudes_liquidacion" FOR UPDATE TO "authenticated" USING ("public"."fn_es_admin"());



ALTER TABLE "public"."solicitudes_liquidacion" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."notificaciones";



GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






















































































































































GRANT ALL ON FUNCTION "public"."fn_hoy"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_hoy"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_hoy"() TO "service_role";



GRANT ALL ON TABLE "public"."lotes" TO "anon";
GRANT ALL ON TABLE "public"."lotes" TO "authenticated";
GRANT ALL ON TABLE "public"."lotes" TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_abrir_lote"("p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_abrir_lote"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_abrir_lote"("p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON SEQUENCE "public"."recibos_devolucion_numero_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."recibos_devolucion_numero_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."recibos_devolucion_numero_seq" TO "service_role";



GRANT ALL ON TABLE "public"."recibos_devolucion" TO "anon";
GRANT ALL ON TABLE "public"."recibos_devolucion" TO "authenticated";
GRANT ALL ON TABLE "public"."recibos_devolucion" TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_anular_recibo"("p_recibo_id" "uuid", "p_motivo" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_anular_recibo"("p_recibo_id" "uuid", "p_motivo" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_anular_recibo"("p_recibo_id" "uuid", "p_motivo" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_auditar"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_auditar"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_auditar"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cerrar_lote"("p_lote_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cerrar_lote"("p_lote_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cerrar_lote"("p_lote_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cheques_after_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cheques_after_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cheques_after_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cheques_before_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cheques_before_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cheques_before_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_cheques_before_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_cheques_before_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_cheques_before_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_crear_recibo_devolucion"("p_cliente_id" "uuid", "p_cheque_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_crear_recibo_devolucion"("p_cliente_id" "uuid", "p_cheque_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_crear_recibo_devolucion"("p_cliente_id" "uuid", "p_cheque_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_es_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_es_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_es_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_firmar_recibo"("p_recibo_id" "uuid", "p_png" "text", "p_aclaracion" "text", "p_dni" "text", "p_hash" "text", "p_ip" "text", "p_ua" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_firmar_recibo"("p_recibo_id" "uuid", "p_png" "text", "p_aclaracion" "text", "p_dni" "text", "p_hash" "text", "p_ip" "text", "p_ua" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_firmar_recibo"("p_recibo_id" "uuid", "p_png" "text", "p_aclaracion" "text", "p_dni" "text", "p_hash" "text", "p_ip" "text", "p_ua" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_handle_new_user"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_handle_new_user"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_handle_new_user"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_historial_cliente"("p_cliente_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."fn_historial_cliente"("p_cliente_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_historial_cliente"("p_cliente_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_liquidaciones_after_insert"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_liquidaciones_after_insert"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_liquidaciones_after_insert"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_logs_inmutables"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_logs_inmutables"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_logs_inmutables"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_marcar_resolucion"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_marcar_resolucion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_marcar_resolucion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_notif_solicitud"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_notif_solicitud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_notif_solicitud"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_proteger_fee_cliente"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_proteger_fee_cliente"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_proteger_fee_cliente"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_rol_actual"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_rol_actual"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_rol_actual"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_sumar_dias_habiles"("fecha_inicio" "date", "dias" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."fn_sumar_dias_habiles"("fecha_inicio" "date", "dias" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_sumar_dias_habiles"("fecha_inicio" "date", "dias" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_liquidacion"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_liquidacion"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_liquidacion"() TO "service_role";



GRANT ALL ON FUNCTION "public"."fn_validar_solicitud"() TO "anon";
GRANT ALL ON FUNCTION "public"."fn_validar_solicitud"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."fn_validar_solicitud"() TO "service_role";


















GRANT ALL ON TABLE "public"."bancos" TO "anon";
GRANT ALL ON TABLE "public"."bancos" TO "authenticated";
GRANT ALL ON TABLE "public"."bancos" TO "service_role";



GRANT ALL ON SEQUENCE "public"."bancos_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."bancos_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."bancos_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."cheques" TO "anon";
GRANT ALL ON TABLE "public"."cheques" TO "authenticated";
GRANT ALL ON TABLE "public"."cheques" TO "service_role";



GRANT ALL ON TABLE "public"."cheques_backup_fechas_20260723" TO "anon";
GRANT ALL ON TABLE "public"."cheques_backup_fechas_20260723" TO "authenticated";
GRANT ALL ON TABLE "public"."cheques_backup_fechas_20260723" TO "service_role";



GRANT ALL ON TABLE "public"."clientes" TO "anon";
GRANT ALL ON TABLE "public"."clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."clientes" TO "service_role";



GRANT ALL ON TABLE "public"."convenios" TO "anon";
GRANT ALL ON TABLE "public"."convenios" TO "authenticated";
GRANT ALL ON TABLE "public"."convenios" TO "service_role";



GRANT ALL ON TABLE "public"."cuentas_bancarias_empresa" TO "anon";
GRANT ALL ON TABLE "public"."cuentas_bancarias_empresa" TO "authenticated";
GRANT ALL ON TABLE "public"."cuentas_bancarias_empresa" TO "service_role";



GRANT ALL ON TABLE "public"."cuits_destino_bloqueados" TO "anon";
GRANT ALL ON TABLE "public"."cuits_destino_bloqueados" TO "authenticated";
GRANT ALL ON TABLE "public"."cuits_destino_bloqueados" TO "service_role";



GRANT ALL ON TABLE "public"."feriados" TO "anon";
GRANT ALL ON TABLE "public"."feriados" TO "authenticated";
GRANT ALL ON TABLE "public"."feriados" TO "service_role";



GRANT ALL ON TABLE "public"."liquidaciones" TO "anon";
GRANT ALL ON TABLE "public"."liquidaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."liquidaciones" TO "service_role";



GRANT ALL ON TABLE "public"."lista_negra_libradores" TO "anon";
GRANT ALL ON TABLE "public"."lista_negra_libradores" TO "authenticated";
GRANT ALL ON TABLE "public"."lista_negra_libradores" TO "service_role";



GRANT ALL ON TABLE "public"."logs_auditoria" TO "anon";
GRANT ALL ON TABLE "public"."logs_auditoria" TO "authenticated";
GRANT ALL ON TABLE "public"."logs_auditoria" TO "service_role";



GRANT ALL ON SEQUENCE "public"."logs_auditoria_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."logs_auditoria_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."logs_auditoria_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."movimientos_clientes" TO "anon";
GRANT ALL ON TABLE "public"."movimientos_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."movimientos_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones" TO "service_role";



GRANT ALL ON TABLE "public"."notificaciones_pendientes" TO "anon";
GRANT ALL ON TABLE "public"."notificaciones_pendientes" TO "authenticated";
GRANT ALL ON TABLE "public"."notificaciones_pendientes" TO "service_role";



GRANT ALL ON TABLE "public"."perfiles" TO "anon";
GRANT ALL ON TABLE "public"."perfiles" TO "authenticated";
GRANT ALL ON TABLE "public"."perfiles" TO "service_role";



GRANT ALL ON TABLE "public"."plaft_parametros" TO "anon";
GRANT ALL ON TABLE "public"."plaft_parametros" TO "authenticated";
GRANT ALL ON TABLE "public"."plaft_parametros" TO "service_role";



GRANT ALL ON TABLE "public"."recibos_devolucion_items" TO "anon";
GRANT ALL ON TABLE "public"."recibos_devolucion_items" TO "authenticated";
GRANT ALL ON TABLE "public"."recibos_devolucion_items" TO "service_role";



GRANT ALL ON TABLE "public"."solicitudes_liquidacion" TO "anon";
GRANT ALL ON TABLE "public"."solicitudes_liquidacion" TO "authenticated";
GRANT ALL ON TABLE "public"."solicitudes_liquidacion" TO "service_role";



GRANT ALL ON TABLE "public"."vw_exposicion_banco" TO "anon";
GRANT ALL ON TABLE "public"."vw_exposicion_banco" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_exposicion_banco" TO "service_role";



GRANT ALL ON TABLE "public"."vw_exposicion_cliente" TO "anon";
GRANT ALL ON TABLE "public"."vw_exposicion_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_exposicion_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."vw_concentracion_resumen" TO "anon";
GRANT ALL ON TABLE "public"."vw_concentracion_resumen" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_concentracion_resumen" TO "service_role";



GRANT ALL ON TABLE "public"."vw_facturacion_cheques" TO "anon";
GRANT ALL ON TABLE "public"."vw_facturacion_cheques" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_facturacion_cheques" TO "service_role";



GRANT ALL ON TABLE "public"."vw_ganancias" TO "anon";
GRANT ALL ON TABLE "public"."vw_ganancias" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_ganancias" TO "service_role";



GRANT ALL ON TABLE "public"."vw_kpi_clientes" TO "anon";
GRANT ALL ON TABLE "public"."vw_kpi_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_kpi_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_libradores_stats" TO "anon";
GRANT ALL ON TABLE "public"."vw_libradores_stats" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_libradores_stats" TO "service_role";



GRANT ALL ON TABLE "public"."vw_libradores_score" TO "anon";
GRANT ALL ON TABLE "public"."vw_libradores_score" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_libradores_score" TO "service_role";



GRANT ALL ON TABLE "public"."vw_metricas_ganancia" TO "anon";
GRANT ALL ON TABLE "public"."vw_metricas_ganancia" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_metricas_ganancia" TO "service_role";



GRANT ALL ON TABLE "public"."vw_metricas_general" TO "anon";
GRANT ALL ON TABLE "public"."vw_metricas_general" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_metricas_general" TO "service_role";



GRANT ALL ON TABLE "public"."vw_pendiente_liquidar" TO "anon";
GRANT ALL ON TABLE "public"."vw_pendiente_liquidar" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_pendiente_liquidar" TO "service_role";



GRANT ALL ON TABLE "public"."vw_plaft_liquidaciones" TO "anon";
GRANT ALL ON TABLE "public"."vw_plaft_liquidaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_plaft_liquidaciones" TO "service_role";



GRANT ALL ON TABLE "public"."vw_plaft_cliente_destino" TO "anon";
GRANT ALL ON TABLE "public"."vw_plaft_cliente_destino" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_plaft_cliente_destino" TO "service_role";



GRANT ALL ON TABLE "public"."vw_plaft_destino_mes_actual" TO "anon";
GRANT ALL ON TABLE "public"."vw_plaft_destino_mes_actual" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_plaft_destino_mes_actual" TO "service_role";



GRANT ALL ON TABLE "public"."vw_plaft_destinos" TO "anon";
GRANT ALL ON TABLE "public"."vw_plaft_destinos" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_plaft_destinos" TO "service_role";



GRANT ALL ON TABLE "public"."vw_plaft_score_cliente" TO "anon";
GRANT ALL ON TABLE "public"."vw_plaft_score_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_plaft_score_cliente" TO "service_role";



GRANT ALL ON TABLE "public"."vw_proyeccion_acreditaciones" TO "anon";
GRANT ALL ON TABLE "public"."vw_proyeccion_acreditaciones" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_proyeccion_acreditaciones" TO "service_role";



GRANT ALL ON TABLE "public"."vw_saldos_clientes" TO "anon";
GRANT ALL ON TABLE "public"."vw_saldos_clientes" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_saldos_clientes" TO "service_role";



GRANT ALL ON TABLE "public"."vw_tendencia_cliente" TO "anon";
GRANT ALL ON TABLE "public"."vw_tendencia_cliente" TO "authenticated";
GRANT ALL ON TABLE "public"."vw_tendencia_cliente" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































