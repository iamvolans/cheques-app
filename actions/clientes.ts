"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const esquemaCliente = z.object({
  razon_social: z.string().min(2, "Razón social muy corta"),
  cuit: z
    .string()
    .regex(/^\d{2}-?\d{8}-?\d$/, "CUIT inválido (formato: 30-12345678-9)"),
  email: z.string().email("Email inválido"),
  fee_porcentaje: z.coerce
    .number()
    .min(0, "El fee no puede ser negativo")
    .max(100, "El fee no puede superar 100%"),
  fee_interior_porcentaje: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).max(100, "Fee interior fuera de rango").nullable()
  ),
});

export type EstadoCliente = { error: string | null; ok?: boolean };

export async function crearCliente(
  _prev: EstadoCliente,
  formData: FormData
): Promise<EstadoCliente> {
  const datos = esquemaCliente.safeParse({
    razon_social: formData.get("razon_social"),
    cuit: formData.get("cuit"),
    email: formData.get("email"),
    fee_porcentaje: formData.get("fee_porcentaje"),
    fee_interior_porcentaje: formData.get("fee_interior_porcentaje"),
  });

  if (!datos.success) {
    return { error: datos.error.issues[0].message };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { error } = await supabase.from("clientes").insert({
    ...datos.data,
    created_by: user.id,
  });

  if (error) {
    if (error.code === "23505") {
      return { error: "Ya existe un cliente con ese CUIT." };
    }
    return { error: "Error al guardar: " + error.message };
  }

  revalidatePath("/clientes");
  return { error: null, ok: true };
}

const esquemaEdicion = z.object({
  cliente_id: z.string().uuid(),
  email: z.string().email("Email inválido"),
  fee_porcentaje: z.coerce.number().min(0).max(100, "Fee fuera de rango"),
  fee_interior_porcentaje: z.preprocess(
    (v) => (v === "" || v === null ? null : v),
    z.coerce.number().min(0).max(100, "Fee interior fuera de rango").nullable()
  ),
});

export async function editarCliente(
  _prev: EstadoCliente,
  formData: FormData
): Promise<EstadoCliente> {
  const datos = esquemaEdicion.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { error } = await supabase
    .from("clientes")
    .update({
      email: datos.data.email,
      fee_porcentaje: datos.data.fee_porcentaje,
      fee_interior_porcentaje: datos.data.fee_interior_porcentaje,
    })
    .eq("id", datos.data.cliente_id);

  if (error) return { error: error.message };

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${datos.data.cliente_id}`);
  return { error: null, ok: true };
}
