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
    cuit_beneficiario: z
      .string()
      .regex(/^\d{2}-?\d{8}-?\d$/, "El CUIT del beneficiario es obligatorio (11 dígitos)"),
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

// ---------- Liquidar solicitud con comprobante adjunto ----------

export type EstadoProc = { error: string | null; ok?: boolean };

export async function procesarSolicitud(
  _prev: EstadoProc,
  formData: FormData
): Promise<EstadoProc> {
  const err = await exigirAdminLiq();
  if (err) return { error: err };

  const solicitudId = String(formData.get("solicitud_id") ?? "");
  const coelsaId = String(formData.get("coelsa_id") ?? "");
  const fecha = String(formData.get("fecha") ?? "");
  if (!solicitudId) return { error: "Solicitud inválida" };
  if (coelsaId.length < 3) return { error: "Falta el Coelsa ID" };
  if (fecha.length < 10) return { error: "Falta la fecha de transferencia" };

  const supabase = await createClient();
  const { data: sol } = await supabase
    .from("solicitudes_liquidacion").select("*").eq("id", solicitudId).single();
  if (!sol || sol.estado !== "pendiente") return { error: "La solicitud no está pendiente." };

  // Comprobante opcional → Drive (_Comprobantes/[Mes]/[día])
  let compId: string | null = null;
  let compNombre: string | null = null;
  const archivo = formData.get("comprobante");
  if (archivo && typeof archivo !== "string" && archivo.size > 0) {
    if (archivo.size > 8 * 1024 * 1024) return { error: "El comprobante supera los 8 MB." };
    try {
      const { carpetaDelDia, subirArchivo } = await import("@/lib/google-drive/drive");
      const carpeta = await carpetaDelDia("_Comprobantes");
      const buffer = Buffer.from(await archivo.arrayBuffer());
      const subido = await subirArchivo(
        buffer,
        `comprobante_${coelsaId}_${archivo.name}`,
        archivo.type || "application/octet-stream",
        carpeta
      );
      compId = subido.id;
      compNombre = archivo.name;
    } catch (e) {
      return { error: "Error subiendo el comprobante a Drive: " + (e as Error).message };
    }
  }

  const { data: liq, error } = await supabase
    .from("liquidaciones")
    .insert({
      cliente_id: sol.cliente_id,
      coelsa_id: coelsaId,
      fecha_transferencia: fecha,
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
    .update({
      estado: "procesada",
      liquidacion_id: liq.id,
      comprobante_drive_id: compId,
      comprobante_nombre: compNombre,
      comprobante_subido_at: compId ? new Date().toISOString() : null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", sol.id);
  if (e2) return { error: e2.message };

  // Encolar el aviso por email al cliente (lo despacha el cron de notificaciones)
  const { data: cli } = await supabase
    .from("clientes")
    .select("email, portal_token")
    .eq("id", sol.cliente_id)
    .single();
  if (cli?.email) {
    const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://cheques-app-black.vercel.app";
    await supabase.from("notificaciones_pendientes").insert({
      cliente_id: sol.cliente_id,
      tipo: "transferencia_realizada",
      payload: {
        monto: sol.monto,
        beneficiario: sol.beneficiario,
        coelsa_id: coelsaId,
        fecha: fecha,
        tiene_comprobante: Boolean(compId),
        portal_url: cli.portal_token ? `${base}/portal/${cli.portal_token}` : null,
      },
    });
  }

  revalidatePath("/liquidaciones");
  revalidatePath("/clientes");
  return { error: null, ok: true };
}

// ---------- Bloqueo manual de destinos (concentración) ----------

export async function bloquearDestino(p: {
  cuit: string;
  motivo?: string;
}): Promise<{ error: string | null }> {
  const err = await exigirAdminLiq();
  if (err) return { error: err };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("cuits_destino_bloqueados")
    .upsert({ cuit: p.cuit, motivo: p.motivo || "Concentración de transferencias" });
  if (error) return { error: error.message };
  revalidatePath("/liquidaciones");
  return { error: null };
}

export async function desbloquearDestino(p: {
  cuit: string;
}): Promise<{ error: string | null }> {
  const err = await exigirAdminLiq();
  if (err) return { error: err };
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("cuits_destino_bloqueados")
    .delete()
    .eq("cuit", p.cuit);
  if (error) return { error: error.message };
  revalidatePath("/liquidaciones");
  return { error: null };
}
