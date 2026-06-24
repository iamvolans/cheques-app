"use server";

import { createClient } from "@/lib/supabase/server";

export type RiesgoLibrador = {
  encontrado: boolean;
  score: number;
  banda: string;
  total_cheques: number;
  cheques_rechazados: number;
  pct_rechazo: number;
  en_lista_negra: boolean;
  fecha_ultimo_rechazo: string | null;
};

// Normaliza el CUIT a solo dígitos para comparar sin importar el formato
function soloDigitos(s: string) {
  return (s ?? "").replace(/\D/g, "");
}

export async function consultarRiesgoLibrador(
  cuit: string
): Promise<{ error: string | null; riesgo?: RiesgoLibrador }> {
  const digitos = soloDigitos(cuit);
  if (digitos.length !== 11) return { error: null }; // CUIT incompleto: no consultamos

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };

  // La vista guarda el CUIT como viene en cheques (con o sin guiones).
  // Comparamos por dígitos para ser robustos ante el formato.
  const { data, error } = await supabase
    .from("vw_libradores_score")
    .select("cuit_librador, score_riesgo, banda_riesgo, total_cheques, cheques_rechazados, pct_rechazo, en_lista_negra, fecha_ultimo_rechazo");

  if (error) return { error: "No se pudo consultar el riesgo." };

  const fila = (data ?? []).find((r) => soloDigitos(r.cuit_librador) === digitos);
  if (!fila) {
    return { error: null, riesgo: { encontrado: false, score: 0, banda: "sin_historial", total_cheques: 0, cheques_rechazados: 0, pct_rechazo: 0, en_lista_negra: false, fecha_ultimo_rechazo: null } };
  }

  return {
    error: null,
    riesgo: {
      encontrado: true,
      score: Number(fila.score_riesgo),
      banda: fila.banda_riesgo as string,
      total_cheques: Number(fila.total_cheques),
      cheques_rechazados: Number(fila.cheques_rechazados),
      pct_rechazo: Number(fila.pct_rechazo),
      en_lista_negra: Boolean(fila.en_lista_negra),
      fecha_ultimo_rechazo: fila.fecha_ultimo_rechazo as string | null,
    },
  };
}
