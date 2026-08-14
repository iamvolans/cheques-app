"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function registrarReintegro(p: {
  clienteId: string;
  monto: number;
  motivo: string;
  otp: string;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  if (!(p.monto > 0)) return { error: "El monto debe ser mayor a cero." };
  if (p.motivo.trim().length < 3) return { error: "Indicá el motivo del reintegro." };
  if (!/^\d{6}$/.test(p.otp)) return { error: "El código de segundo factor debe tener 6 dígitos." };

  // Verificación del segundo factor: el reintegro mueve saldo y ganancia, va con MFA
  const { data: factores } = await supabase.auth.mfa.listFactors();
  const totp = factores?.totp?.[0];
  if (!totp) return { error: "No tenés configurado el segundo factor (Google Authenticator)." };

  const { data: desafio, error: eDes } = await supabase.auth.mfa.challenge({ factorId: totp.id });
  if (eDes || !desafio) return { error: "No se pudo iniciar la verificación. Reintentá." };

  const { error: eVer } = await supabase.auth.mfa.verify({
    factorId: totp.id,
    challengeId: desafio.id,
    code: p.otp,
  });
  if (eVer) return { error: "Código incorrecto. Verificá tu app de autenticación." };

  const { error } = await supabase.rpc("fn_reintegro_comision", {
    p_cliente_id: p.clienteId,
    p_monto: p.monto,
    p_motivo: p.motivo,
  });
  if (error) return { error: error.message };

  revalidatePath("/clientes/" + p.clienteId);
  revalidatePath("/dashboard");
  return { error: null };
}
