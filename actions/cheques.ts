"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { carpetaDelDia, subirArchivo, borrarArchivo } from "@/lib/google-drive/drive";

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
  fecha_cobro: z.string().min(10, "Falta la fecha de cobro"),
  codigo_postal: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().int().min(1, "CP inválido").max(9999, "CP inválido").nullable()
  ),
  echeq_id: z.string().optional(),
  portador_banco: z.string().optional(),
});

export type EstadoCheque = { error: string | null; ok?: boolean; alerta?: string | null };

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
      const pref = `cheque_${d.numero_cheque}`;
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
      echeq_id: d.tipo === "echeq" ? d.echeq_id : null,
      portador_banco: d.portador_banco || null,
      foto_frente_url,
      foto_dorso_url,
      pdf_endoso_url,
      fee_aplicado_pct: 0,
      fee_calculado: 0,
    })
    .select("alerta_lista_negra, estado, fecha_cobro, plaza, fee_aplicado_pct")
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
  if (insertado?.plaza === "interior") {
    avisos.push(`Plaza Interior: fee aplicado ${Number(insertado.fee_aplicado_pct).toFixed(2)}%.`);
  }

  revalidatePath("/cheques");
  return { error: null, ok: true, alerta: avisos.length ? avisos.join(" ") : null };
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
