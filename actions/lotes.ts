"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export type Lote = { id: string; numero: number; cliente_id: string; fecha: string };
export type EstadoLote = { error: string | null; lote?: Lote | null };

export async function abrirLote(clienteId: string): Promise<EstadoLote> {
  if (!clienteId) return { error: "Elegí el cliente antes de abrir el lote." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data, error } = await supabase.rpc("fn_abrir_lote", { p_cliente_id: clienteId });
  if (error) return { error: error.message };

  revalidatePath("/cheques");
  return { error: null, lote: data as Lote };
}

export async function cerrarLote(loteId: string): Promise<EstadoLote> {
  if (!loteId) return { error: "No hay lote abierto." };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { error } = await supabase.rpc("fn_cerrar_lote", { p_lote_id: loteId });
  if (error) return { error: error.message };

  revalidatePath("/cheques");
  return { error: null, lote: null };
}
