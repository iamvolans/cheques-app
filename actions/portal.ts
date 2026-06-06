"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

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
