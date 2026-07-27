"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

export async function crearRecibo(
  ids: string[]
): Promise<{ error: string | null; reciboId?: string; numero?: number }> {
  if (!ids || ids.length === 0) return { error: "No seleccionaste ningún cheque." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: chs, error: e1 } = await supabase
    .from("cheques")
    .select("id, cliente_id, estado, recibo_id, numero_cheque, clientes(razon_social)")
    .in("id", ids);
  if (e1) return { error: e1.message };
  if (!chs || chs.length === 0) return { error: "No se encontraron los cheques." };

  const clientes = Array.from(new Set(chs.map((c) => c.cliente_id)));
  if (clientes.length > 1) {
    return { error: "El recibo tiene que ser de un solo cliente. Filtrá por cliente antes de seleccionar." };
  }
  const noRechazados = chs.filter((c) => c.estado !== "rechazado");
  if (noRechazados.length > 0) {
    return {
      error: "Solo se pueden devolver cheques rechazados. Revisá: " +
        noRechazados.slice(0, 5).map((c) => "N° " + c.numero_cheque).join(", "),
    };
  }
  const yaConRecibo = chs.filter((c) => c.recibo_id);
  if (yaConRecibo.length > 0) {
    return {
      error: "Ya tienen recibo vigente: " +
        yaConRecibo.slice(0, 5).map((c) => "N° " + c.numero_cheque).join(", "),
    };
  }

  const { data, error } = await supabase.rpc("fn_crear_recibo_devolucion", {
    p_cliente_id: clientes[0],
    p_cheque_ids: chs.map((c) => c.id),
  });
  if (error) return { error: error.message };

  const rec = data as { id: string; numero: number };
  revalidatePath("/cheques");
  return { error: null, reciboId: rec.id, numero: rec.numero };
}

export async function anularRecibo(
  reciboId: string,
  motivo: string
): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { error } = await supabase.rpc("fn_anular_recibo", {
    p_recibo_id: reciboId,
    p_motivo: motivo,
  });
  if (error) return { error: error.message };

  revalidatePath("/cheques");
  revalidatePath("/recibos/" + reciboId);
  return { error: null };
}
