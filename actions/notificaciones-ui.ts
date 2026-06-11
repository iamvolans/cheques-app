"use server";

import { createClient } from "@/lib/supabase/server";

export type NotifRow = {
  id: string;
  tipo: string;
  titulo: string;
  detalle: string | null;
  link: string | null;
  cliente_id: string | null;
  leida: boolean;
  created_at: string;
};

export async function listarNotificaciones(): Promise<{ items: NotifRow[]; error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { items: [], error: "Sin sesión" };
  const { data } = await supabase
    .from("notificaciones")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(30);
  return { items: (data as NotifRow[]) ?? [], error: null };
}

export async function marcarTodasLeidas(): Promise<{ error: string | null }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sin sesión" };
  const { error } = await supabase.from("notificaciones").update({ leida: true }).eq("leida", false);
  return { error: error?.message ?? null };
}
