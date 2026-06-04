"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

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
  echeq_id: z.string().optional(),
  portador_banco: z.string().optional(),
});

export type EstadoCheque = { error: string | null; ok?: boolean; alerta?: string | null };

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
      echeq_id: d.tipo === "echeq" ? d.echeq_id : null,
      portador_banco: d.portador_banco || null,
      fee_aplicado_pct: 0, // lo pisa el trigger con el fee real del cliente
      fee_calculado: 0,
    })
    .select("alerta_lista_negra")
    .single();

  if (error) {
    if (error.code === "23505") {
      return { error: "DUPLICADO: ya existe un cheque con ese N° y ese CUIT de librador." };
    }
    return { error: error.message };
  }

  revalidatePath("/cheques");
  return {
    error: null,
    ok: true,
    alerta: insertado?.alerta_lista_negra
      ? "⚠ ATENCIÓN: este librador está en la LISTA NEGRA."
      : null,
  };
}

const transicionesValidas: Record<string, string[]> = {
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
}): Promise<{ error: string | null }> {
  const { chequeId, estadoActual, nuevoEstado, multa, motivo } = input;

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
