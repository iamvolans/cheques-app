"use server";

import { hoyART } from "@/lib/fechas";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { carpetaDelDia, subirArchivo, borrarArchivo } from "@/lib/google-drive/drive";
import { aplicarFiltros, type FiltrosCheques } from "@/lib/filtros-cheques";

const esquemaCheque = z.object({
  tipo: z.enum(["fisico", "echeq"]),
  numero_cheque: z.string().min(1, "Falta el N° de cheque"),
  librador: z.string().min(2, "Falta el librador"),
  cuit_librador: z
    .string()
    .regex(/^\d{2}-?\d{8}-?\d$/, "CUIT del librador inválido"),
  monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
  endosos: z.coerce.number().int().min(0).default(0),
  banco_emisor: z.string().min(2, "Falta el banco emisor"),
  cliente_id: z.string().uuid("Elegí un cliente"),
  convenio_id: z.string().uuid("Elegí un convenio"),
  cuenta_bancaria_id: z.string().uuid("Elegí la cuenta propia"),
  fecha_cobro: z.string().min(10, "Falta la fecha de pago del cheque"),
  fecha_carga: z.string().optional(),
  fecha_deposito: z.string().optional(),
  lote_id: z.string().optional(),
  lote_numero: z.string().optional(),
  foto_numero: z.string().optional(),
  codigo_postal: z.coerce
    .number({ error: "El C.P. es obligatorio" })
    .int("C.P. inválido")
    .min(1, "El C.P. es obligatorio")
    .max(9999, "C.P. inválido"),
  echeq_id: z.string().optional(),
  portador_banco: z.string().optional(),
});

export type EstadoCheque = { error: string | null; ok?: boolean; alerta?: string | null; foto?: number | null };

const MAX_ARCHIVO = 8 * 1024 * 1024; // 8 MB

async function archivoABuffer(f: FormDataEntryValue | null): Promise<{ buffer: Buffer; tipo: string; nombre: string } | null> {
  if (!f || typeof f === "string" || f.size === 0) return null;
  if (f.size > MAX_ARCHIVO) throw new Error(`El archivo ${f.name} supera los 8 MB.`);
  return { buffer: Buffer.from(await f.arrayBuffer()), tipo: f.type, nombre: f.name };
}

export async function crearCheque(
  _prev: EstadoCheque,
  formData: FormData
): Promise<EstadoCheque> {
  const datos = esquemaCheque.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const d = datos.data;
  if (d.tipo === "echeq" && !d.echeq_id) {
    return { error: "Los E-Cheqs requieren el ID único de E-Cheq." };
  }

  const enRango = (v?: string) => !v || (v >= "2000-01-01" && v <= "2100-01-01");
  if (!enRango(d.fecha_cobro) || !enRango(d.fecha_carga) || !enRango(d.fecha_deposito)) {
    return { error: "Hay una fecha fuera de rango (el año debe estar entre 2000 y 2100). Revisá lo tipeado." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  // Archivos adjuntos (opcionales)
  let frente, dorso, pdf;
  try {
    frente = await archivoABuffer(formData.get("foto_frente"));
    dorso = await archivoABuffer(formData.get("foto_dorso"));
    pdf = await archivoABuffer(formData.get("pdf_endoso"));
  } catch (e) {
    return { error: (e as Error).message };
  }

  // Subida a Drive: [Raíz]/[Cliente]/[Mes]/[dd-MM]
  const subidos: string[] = [];
  let foto_frente_url: string | null = null;
  let foto_dorso_url: string | null = null;
  let pdf_endoso_url: string | null = null;

  if (frente || dorso || pdf) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("razon_social")
      .eq("id", d.cliente_id)
      .single();
    if (!cliente) return { error: "Cliente inexistente." };

    try {
      const carpeta = await carpetaDelDia(cliente.razon_social);
      const pad = (v?: string) => String(v ?? "").padStart(2, "0");
      const pref = d.lote_id
        ? "lote" + pad(d.lote_numero) + "_foto" + pad(d.foto_numero) + "_cheque_" + d.numero_cheque
        : "cheque_" + d.numero_cheque;
      if (frente) {
        const r = await subirArchivo(frente.buffer, `${pref}_frente_${frente.nombre}`, frente.tipo, carpeta);
        subidos.push(r.id);
        foto_frente_url = r.url;
      }
      if (dorso) {
        const r = await subirArchivo(dorso.buffer, `${pref}_dorso_${dorso.nombre}`, dorso.tipo, carpeta);
        subidos.push(r.id);
        foto_dorso_url = r.url;
      }
      if (pdf) {
        const r = await subirArchivo(pdf.buffer, `${pref}_endoso_${pdf.nombre}`, pdf.tipo, carpeta);
        subidos.push(r.id);
        pdf_endoso_url = r.url;
      }
    } catch (e) {
      await Promise.all(subidos.map(borrarArchivo));
      return { error: "Error subiendo a Google Drive: " + (e as Error).message };
    }
  }

  const { data: insertado, error } = await supabase
    .from("cheques")
    .insert({
      tipo: d.tipo,
      numero_cheque: d.numero_cheque,
      librador: d.librador,
      cuit_librador: d.cuit_librador,
      monto: d.monto,
      endosos: d.endosos,
      banco_emisor: d.banco_emisor,
      cliente_id: d.cliente_id,
      convenio_id: d.convenio_id,
      cuenta_bancaria_id: d.cuenta_bancaria_id,
      fecha_cobro: d.fecha_cobro,
      codigo_postal: d.codigo_postal,
      fecha_pago: d.fecha_cobro,
      fecha_carga: d.fecha_carga || null,
      fecha_deposito: d.fecha_deposito || null,
      lote_id: d.lote_id || null,
      foto_numero: d.foto_numero ? Number(d.foto_numero) : null,
      echeq_id: d.tipo === "echeq" ? d.echeq_id : null,
      portador_banco: d.portador_banco || null,
      foto_frente_url,
      foto_dorso_url,
      pdf_endoso_url,
      fee_aplicado_pct: 0,
      fee_calculado: 0,
    })
    .select("alerta_lista_negra, estado, fecha_cobro, plaza, fee_aplicado_pct, foto_numero")
    .single();

  if (error) {
    // Rollback: si la base rechazó el cheque, borramos lo subido a Drive
    await Promise.all(subidos.map(borrarArchivo));
    if (error.code === "23505") {
      return { error: "DUPLICADO: ya existe un cheque con ese N° y ese CUIT de librador." };
    }
    return { error: error.message };
  }

  const avisos: string[] = [];
  if (insertado?.alerta_lista_negra) {
    avisos.push("⚠ ATENCIÓN: este librador está en la LISTA NEGRA.");
  }
  if (insertado?.estado === "en_custodia") {
    avisos.push(`⏳ Diferido: quedó EN CUSTODIA hasta el ${insertado.fecha_cobro}.`);
  }
  if (insertado?.estado === "depositado") {
    avisos.push("Cargado ya EN CLEARING con fecha de depósito " + d.fecha_deposito + ".");
  }
  if (insertado?.plaza === "interior") {
    avisos.push(`Plaza Interior: fee aplicado ${Number(insertado.fee_aplicado_pct).toFixed(2)}%.`);
  }

  revalidatePath("/cheques");
  return {
    error: null,
    ok: true,
    alerta: avisos.length ? avisos.join(" ") : null,
    foto: insertado?.foto_numero ?? null,
  };
}

const transicionesValidas: Record<string, string[]> = {
  en_custodia: ["depositado"],
  aceptado: ["depositado"],
  depositado: ["procesado", "rechazado"],
  procesado: ["rechazado"],
};

export async function cambiarEstado(input: {
  chequeId: string;
  estadoActual: string;
  nuevoEstado: string;
  multa?: number;
  motivo?: string;
  gasto?: number;
}): Promise<{ error: string | null }> {
  const { chequeId, estadoActual, nuevoEstado, multa, motivo, gasto } = input;

  if (!transicionesValidas[estadoActual]?.includes(nuevoEstado)) {
    return { error: `Transición inválida: ${estadoActual} → ${nuevoEstado}` };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  if (nuevoEstado === "rechazado") {
    const { data: perfil } = await supabase
      .from("perfiles").select("rol").eq("id", user.id).single();
    if (perfil?.rol !== "administrador") {
      return { error: "Solo un Administrador puede rechazar cheques." };
    }
  }

  const cambios: Record<string, unknown> = { estado: nuevoEstado };
  if (nuevoEstado === "rechazado") {
    cambios.multa = multa ?? 0;
    cambios.motivo_rechazo = motivo || "Falta de fondos";
    cambios.gasto_bancario = gasto ?? 0;
  }

  const { error } = await supabase
    .from("cheques")
    .update(cambios)
    .eq("id", chequeId)
    .eq("estado", estadoActual);

  if (error) return { error: error.message };

  revalidatePath("/cheques");
  revalidatePath("/clientes");
  return { error: null };
}


// ---------- Depósito en lote: pasa a "depositado" todos los seleccionados ----------
export async function depositarLote(ids: string[]): Promise<{
  error: string | null;
  ok?: number;
  fallidos?: { numero: string; motivo: string }[];
}> {
  if (!ids || ids.length === 0) return { error: "No seleccionaste ningún cheque." };
  if (ids.length > 300) return { error: "Máximo 300 cheques por lote." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const hoy = hoyART();
  const { data: chs } = await supabase
    .from("cheques")
    .select("id, numero_cheque, estado, fecha_cobro")
    .in("id", ids);

  let okCount = 0;
  const fallidos: { numero: string; motivo: string }[] = [];

  for (const ch of chs ?? []) {
    const depositable = ch.estado === "aceptado" || (ch.estado === "en_custodia" && ch.fecha_cobro <= hoy);
    if (!depositable) {
      fallidos.push({
        numero: ch.numero_cheque,
        motivo: ch.estado === "en_custodia" ? `diferido hasta ${ch.fecha_cobro}` : `estado ${ch.estado}`,
      });
      continue;
    }
    // Update individual: los triggers setean fecha_deposito/acreditación y auditan cada uno
    const { error } = await supabase
      .from("cheques")
      .update({ estado: "depositado" })
      .eq("id", ch.id)
      .eq("estado", ch.estado);
    if (error) fallidos.push({ numero: ch.numero_cheque, motivo: error.message });
    else okCount++;
  }

  revalidatePath("/cheques");
  revalidatePath("/dashboard");
  return { error: null, ok: okCount, fallidos };
}


// ---------- Gestión de cheques físicos rechazados: notificado / recuperado / entregado ----------
export async function gestionRechazo(p: {
  chequeId: string;
  paso: "notificado" | "recuperado" | "entregado";
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: ch } = await supabase
    .from("cheques")
    .select("id, numero_cheque, estado, tipo")
    .eq("id", p.chequeId)
    .single();
  if (!ch) return { error: "El cheque no existe." };
  if (ch.estado !== "rechazado") return { error: "Solo aplica a cheques rechazados." };
  if (ch.tipo !== "fisico") return { error: "Solo aplica a cheques físicos." };

  const campo = {
    notificado: "rechazo_notificado_at",
    recuperado: "rechazo_recuperado_at",
    entregado: "rechazo_entregado_at",
  }[p.paso];

  const { error } = await supabase
    .from("cheques")
    .update({ [campo]: new Date().toISOString() })
    .eq("id", ch.id);
  if (error) return { error: error.message };

  revalidatePath(`/cheques/${p.chequeId}`);
  revalidatePath("/cheques");
  return { error: null };
}


// ---------- Acreditar en lote: pasa a "procesado" los seleccionados en Clearing ----------
export async function acreditarLote(ids: string[]): Promise<{
  error: string | null;
  ok?: number;
  fallidos?: { numero: string; motivo: string }[];
}> {
  if (!ids || ids.length === 0) return { error: "No seleccionaste ningún cheque." };
  if (ids.length > 300) return { error: "Máximo 300 cheques por lote." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: chs } = await supabase
    .from("cheques")
    .select("id, numero_cheque, estado")
    .in("id", ids);

  let okCount = 0;
  const fallidos: { numero: string; motivo: string }[] = [];
  for (const ch of chs ?? []) {
    if (ch.estado !== "depositado") {
      fallidos.push({ numero: ch.numero_cheque, motivo: "estado " + ch.estado });
      continue;
    }
    const { error } = await supabase
      .from("cheques")
      .update({ estado: "procesado" })
      .eq("id", ch.id)
      .eq("estado", "depositado");
    if (error) fallidos.push({ numero: ch.numero_cheque, motivo: error.message });
    else okCount++;
  }
  revalidatePath("/cheques");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { error: null, ok: okCount, fallidos };
}

// ---------- Rechazar en lote (solo admin): multa/gasto/motivo comunes ----------
export async function rechazarLote(p: {
  ids: string[];
  multa?: number;
  gasto?: number | null;
  motivo?: string;
}): Promise<{
  error: string | null;
  ok?: number;
  fallidos?: { numero: string; motivo: string }[];
}> {
  if (!p.ids || p.ids.length === 0) return { error: "No seleccionaste ningún cheque." };
  if (p.ids.length > 300) return { error: "Máximo 300 cheques por lote." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo un Administrador puede rechazar cheques." };

  const { data: chs } = await supabase
    .from("cheques")
    .select("id, numero_cheque, estado, cuentas_bancarias_empresa(multa_rechazo_banco)")
    .in("id", p.ids);

  let okCount = 0;
  const fallidos: { numero: string; motivo: string }[] = [];
  for (const ch of chs ?? []) {
    if (ch.estado !== "depositado" && ch.estado !== "procesado") {
      fallidos.push({ numero: ch.numero_cheque, motivo: "estado " + ch.estado });
      continue;
    }
    const defCuenta = Number(
      (ch.cuentas_bancarias_empresa as unknown as { multa_rechazo_banco?: number } | null)?.multa_rechazo_banco ?? 0
    );
    const { error } = await supabase
      .from("cheques")
      .update({
        estado: "rechazado",
        multa: p.multa ?? 0,
        motivo_rechazo: p.motivo && p.motivo.trim() ? p.motivo.trim() : "Falta de fondos",
        gasto_bancario: p.gasto != null ? p.gasto : defCuenta,
      })
      .eq("id", ch.id)
      .eq("estado", ch.estado);
    if (error) fallidos.push({ numero: ch.numero_cheque, motivo: error.message });
    else okCount++;
  }
  revalidatePath("/cheques");
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { error: null, ok: okCount, fallidos };
}

// ---------- IDs de TODO el filtro, no solo la pagina visible ----------
export async function idsFiltrados(
  f: FiltrosCheques
): Promise<{ error: string | null; ids?: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesion vencida. Recarga la pagina." };

  const PASO = 1000;
  const TOPE = 20000;
  const ids: string[] = [];

  for (let desde = 0; desde < TOPE; desde += PASO) {
    let q = supabase
      .from("cheques")
      .select("id")
      .order("created_at", { ascending: false })
      .range(desde, desde + PASO - 1);
    q = aplicarFiltros(q, f);
    const { data, error } = await q;
    if (error) return { error: error.message };
    const lote = data ?? [];
    for (const r of lote) ids.push(r.id);
    if (lote.length < PASO) break;
  }
  return { error: null, ids };
}
