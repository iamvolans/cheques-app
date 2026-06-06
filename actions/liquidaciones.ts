"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const vacioANull = (v: unknown) => (v === "" || v === null ? null : v);

const esquemaLiq = z
  .object({
    cliente_id: z.string().uuid(),
    coelsa_id: z.string().min(3, "Falta el Coelsa ID"),
    fecha_transferencia: z.string().min(10, "Falta la fecha de transferencia"),
    cvu_cbu_destino: z.preprocess(
      vacioANull,
      z
        .string()
        .transform((v) => v.replace(/\D/g, ""))
        .refine((v) => v.length === 22, "El CBU/CVU debe tener 22 dígitos")
        .nullable()
    ),
    alias_destino: z.preprocess(
      vacioANull,
      z.string().min(6, "Alias muy corto (mínimo 6)").max(30, "Alias muy largo").nullable()
    ),
    cuit_beneficiario: z.preprocess(
      vacioANull,
      z.string().regex(/^\d{2}-?\d{8}-?\d$/, "CUIT del beneficiario inválido").nullable()
    ),
    beneficiario: z.string().min(2, "Falta el beneficiario"),
    monto_liquidado: z.coerce.number().positive("El monto debe ser mayor a 0"),
  })
  .refine((d) => d.cvu_cbu_destino || d.alias_destino, {
    message: "Cargá el CBU/CVU o el Alias (al menos uno de los dos)",
    path: ["cvu_cbu_destino"],
  });

export type EstadoLiq = { error: string | null; ok?: boolean };

export async function liquidar(
  _prev: EstadoLiq,
  formData: FormData
): Promise<EstadoLiq> {
  const datos = esquemaLiq.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { error } = await supabase.from("liquidaciones").insert(datos.data);

  if (error) {
    if (error.code === "42501") {
      return { error: "Solo un Administrador puede registrar liquidaciones." };
    }
    return { error: error.message };
  }

  revalidatePath("/clientes");
  revalidatePath("/liquidaciones");
  return { error: null, ok: true };
}

async function exigirAdminLiq(): Promise<string | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "Sesión vencida. Recargá la página.";
  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return "Solo administradores.";
  return null;
}

export async function liquidarDesdeSolicitud(p: {
  solicitudId: string;
  coelsaId: string;
  fecha: string;
}): Promise<{ error: string | null }> {
  const err = await exigirAdminLiq();
  if (err) return { error: err };
  if (!p.coelsaId || p.coelsaId.length < 3) return { error: "Falta el Coelsa ID" };
  if (!p.fecha || p.fecha.length < 10) return { error: "Falta la fecha de transferencia" };

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitudes_liquidacion").select("*").eq("id", p.solicitudId).single();
  if (!sol || sol.estado !== "pendiente") return { error: "La solicitud no está pendiente." };

  const { data: liq, error } = await supabase
    .from("liquidaciones")
    .insert({
      cliente_id: sol.cliente_id,
      coelsa_id: p.coelsaId,
      fecha_transferencia: p.fecha,
      cvu_cbu_destino: sol.cvu_cbu_destino,
      alias_destino: sol.alias_destino,
      cuit_beneficiario: sol.cuit_beneficiario,
      beneficiario: sol.beneficiario,
      monto_liquidado: sol.monto,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  const { error: e2 } = await supabase
    .from("solicitudes_liquidacion")
    .update({ estado: "procesada", liquidacion_id: liq.id, updated_at: new Date().toISOString() })
    .eq("id", sol.id);
  if (e2) return { error: e2.message };

  revalidatePath("/liquidaciones");
  revalidatePath("/clientes");
  return { error: null };
}

export async function rechazarSolicitud(p: {
  solicitudId: string;
  motivo: string;
}): Promise<{ error: string | null }> {
  const err = await exigirAdminLiq();
  if (err) return { error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("solicitudes_liquidacion")
    .update({
      estado: "rechazada",
      motivo_rechazo: p.motivo || "Sin especificar",
      updated_at: new Date().toISOString(),
    })
    .eq("id", p.solicitudId)
    .eq("estado", "pendiente");
  if (error) return { error: error.message };

  revalidatePath("/liquidaciones");
  return { error: null };
}
