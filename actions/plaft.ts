"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type DestinoPlaft = {
  acumuladoMes: number;
  transferenciasMes: number;
  clientesMes: number;
  tipoPersona: "fisica" | "juridica" | "desconocido";
  umbral: number;
  pct: number;
  bloqueado: boolean;
};

function soloDigitos(s: string | null | undefined) {
  return (s ?? "").replace(/\D/g, "");
}

export async function consultarDestinoLiquidacion(
  cuit: string
): Promise<{ error: string | null; destino?: DestinoPlaft }> {
  const digitos = soloDigitos(cuit);
  if (digitos.length !== 11) return { error: null };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };

  const admin = createAdminClient();
  const hoy = new Date();
  const inicioMes = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-01`;

  const [{ data: liqs }, { data: params }, { data: bloq }] = await Promise.all([
    admin
      .from("liquidaciones")
      .select("cliente_id, monto_liquidado, cuit_beneficiario")
      .gte("fecha_transferencia", inicioMes),
    admin.from("plaft_parametros").select("*").eq("id", 1).maybeSingle(),
    admin.from("cuits_destino_bloqueados").select("cuit"),
  ]);

  const delCuit = (liqs ?? []).filter((l) => soloDigitos(l.cuit_beneficiario) === digitos);
  const acumuladoMes = delCuit.reduce((a, l) => a + Number(l.monto_liquidado), 0);
  const clientesMes = new Set(delCuit.map((l) => l.cliente_id)).size;

  const pref = digitos.slice(0, 2);
  const tipoPersona = ["20", "23", "24", "25", "26", "27"].includes(pref)
    ? ("fisica" as const)
    : ["30", "33", "34"].includes(pref)
    ? ("juridica" as const)
    : ("desconocido" as const);

  const umbral = tipoPersona === "fisica"
    ? Number(params?.umbral_mensual_fisica ?? 10000000)
    : Number(params?.umbral_mensual_juridica ?? 50000000);

  const bloqueado = (bloq ?? []).some((b) => soloDigitos(b.cuit) === digitos);

  return {
    error: null,
    destino: {
      acumuladoMes,
      transferenciasMes: delCuit.length,
      clientesMes,
      tipoPersona,
      umbral,
      pct: umbral > 0 ? (acumuladoMes / umbral) * 100 : 0,
      bloqueado,
    },
  };
}


export async function actualizarUmbralesPlaft(p: {
  fisica: number;
  juridica: number;
}): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo un Administrador puede modificar los umbrales." };
  if (!(p.fisica > 0) || !(p.juridica > 0)) return { error: "Los umbrales deben ser mayores a 0." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("plaft_parametros")
    .update({
      umbral_mensual_fisica: p.fisica,
      umbral_mensual_juridica: p.juridica,
      updated_at: new Date().toISOString(),
    })
    .eq("id", 1);
  if (error) return { error: error.message };
  return { error: null };
}
