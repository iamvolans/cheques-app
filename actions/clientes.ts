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
