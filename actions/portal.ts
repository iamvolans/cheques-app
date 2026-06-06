"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

async function exigirAdmin(): Promise<string | null> {
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

export async function generarPortalToken(p: {
  clienteId: string;
}): Promise<{ error: string | null; token?: string }> {
  const err = await exigirAdmin();
  if (err) return { error: err };

  const token = randomBytes(32).toString("hex");
  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ portal_token: token })
    .eq("id", p.clienteId);
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${p.clienteId}`);
  return { error: null, token };
}

export async function revocarPortalToken(p: {
  clienteId: string;
}): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };

  const supabase = await createClient();
  const { error } = await supabase
    .from("clientes")
    .update({ portal_token: null })
    .eq("id", p.clienteId);
  if (error) return { error: error.message };

  revalidatePath(`/clientes/${p.clienteId}`);
  return { error: null };
}

// ---------- Solicitudes de liquidación desde el portal ----------

const vacioANull = (v: unknown) => (v === "" || v === null ? null : v);

const esquemaSolicitud = z
  .object({
    token: z.string().min(32),
    monto: z.coerce.number().positive("El monto debe ser mayor a 0"),
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
      z.string().min(6, "Alias muy corto").max(30, "Alias muy largo").nullable()
    ),
    cuit_beneficiario: z
      .string()
      .regex(/^\d{2}-?\d{8}-?\d$/, "El CUIT/CUIL del beneficiario es obligatorio (11 dígitos)"),
    beneficiario: z.string().min(2, "Falta el beneficiario"),
    nota: z.preprocess(vacioANull, z.string().max(200).nullable()),
  })
  .refine((d) => d.cvu_cbu_destino || d.alias_destino, {
    message: "Cargá el CBU/CVU o el Alias del destino",
    path: ["cvu_cbu_destino"],
  });

export type EstadoSolicitud = { error: string | null; ok?: boolean };

export async function crearSolicitudLiquidacion(
  _prev: EstadoSolicitud,
  formData: FormData
): Promise<EstadoSolicitud> {
  const datos = esquemaSolicitud.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const admin = createAdminClient();
  const { data: cliente } = await admin
    .from("clientes")
    .select("id")
    .eq("portal_token", datos.data.token)
    .single();
  if (!cliente) return { error: "Portal inválido o revocado." };

  const { token: _t, ...payload } = datos.data;
  const { error } = await admin.from("solicitudes_liquidacion").insert({
    cliente_id: cliente.id,
    ...payload,
  });
  if (error) return { error: error.message };

  revalidatePath(`/portal/${datos.data.token}`);
  revalidatePath("/liquidaciones");
  return { error: null, ok: true };
}
