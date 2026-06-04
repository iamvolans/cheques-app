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
