"use server";

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

export type EstadoConfig = { error: string | null; ok?: boolean };

function refrescar() {
  revalidatePath("/admin/configuracion");
  revalidatePath("/cheques");
}

// ---------- LISTA NEGRA ----------
export async function agregarListaNegra(_p: EstadoConfig, fd: FormData): Promise<EstadoConfig> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const cuit = String(fd.get("cuit") ?? "").trim();
  if (!/^\d{2}-?\d{8}-?\d$/.test(cuit)) return { error: "CUIT inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("lista_negra_libradores").insert({
    cuit,
    razon_social: String(fd.get("razon_social") ?? "") || null,
    motivo: String(fd.get("motivo") ?? "") || "Sin especificar",
  });
  if (error) return { error: error.code === "23505" ? "Ese CUIT ya está en la lista" : error.message };
  refrescar();
  return { error: null, ok: true };
}

export async function quitarListaNegra(p: { id: string }): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("lista_negra_libradores").delete().eq("id", p.id);
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}

// ---------- CONVENIOS ----------
export async function agregarConvenio(_p: EstadoConfig, fd: FormData): Promise<EstadoConfig> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const cuit = String(fd.get("cuit") ?? "").trim();
  if (!/^\d{2}-?\d{8}-?\d$/.test(cuit)) return { error: "CUIT inválido" };
  const supabase = await createClient();
  const { error } = await supabase.from("convenios").insert({
    razon_social: String(fd.get("razon_social") ?? ""),
    cuit,
  });
  if (error) return { error: error.code === "23505" ? "Ese CUIT ya existe" : error.message };
  refrescar();
  return { error: null, ok: true };
}

export async function toggleConvenio(p: { id: string; activo: boolean }): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("convenios").update({ activo: p.activo }).eq("id", p.id);
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}

// ---------- CUENTAS BANCARIAS ----------
export async function agregarCuenta(_p: EstadoConfig, fd: FormData): Promise<EstadoConfig> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const banco = String(fd.get("banco") ?? "").trim();
  if (banco.length < 2) return { error: "Falta el banco" };
  const supabase = await createClient();
  const { error } = await supabase.from("cuentas_bancarias_empresa").insert({
    banco,
    alias: String(fd.get("alias") ?? "") || null,
    cbu: String(fd.get("cbu") ?? "") || null,
    descripcion: String(fd.get("descripcion") ?? "") || null,
    multa_rechazo_banco: Number(fd.get("multa_rechazo_banco")) || 0,
  });
  if (error) return { error: error.message };
  refrescar();
  return { error: null, ok: true };
}

export async function toggleCuenta(p: { id: string; activa: boolean }): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("cuentas_bancarias_empresa").update({ activa: p.activa }).eq("id", p.id);
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}

// ---------- FERIADOS ----------
export async function agregarFeriado(_p: EstadoConfig, fd: FormData): Promise<EstadoConfig> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const fecha = String(fd.get("fecha") ?? "");
  if (fecha.length < 10) return { error: "Falta la fecha" };
  const supabase = await createClient();
  const { error } = await supabase.from("feriados").insert({
    fecha,
    descripcion: String(fd.get("descripcion") ?? "") || "Feriado",
  });
  if (error) return { error: error.code === "23505" ? "Esa fecha ya está cargada" : error.message };
  refrescar();
  return { error: null, ok: true };
}

export async function quitarFeriado(p: { fecha: string }): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  const supabase = await createClient();
  const { error } = await supabase.from("feriados").delete().eq("fecha", p.fecha);
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}

import { sincronizarFeriadosAnio } from "@/lib/feriados";

export async function sincronizarFeriados(
  _p: Record<string, never>
): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };

  const anio = new Date().getFullYear();
  try {
    await sincronizarFeriadosAnio(anio);
    await sincronizarFeriadosAnio(anio + 1);
  } catch (e) {
    return { error: "No se pudo sincronizar: " + (e as Error).message };
  }
  refrescar();
  return { error: null };
}

export async function actualizarMultaCuenta(p: {
  id: string;
  multa: number;
}): Promise<{ error: string | null }> {
  const err = await exigirAdmin();
  if (err) return { error: err };
  if (!(p.multa >= 0)) return { error: "Multa inválida" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("cuentas_bancarias_empresa")
    .update({ multa_rechazo_banco: p.multa })
    .eq("id", p.id);
  if (error) return { error: error.message };
  refrescar();
  return { error: null };
}
