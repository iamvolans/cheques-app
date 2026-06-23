"use server";

import bcrypt from "bcryptjs";
import { generateSecret, generateURI, verify as verifyTotp } from "otplib";
import QRCode from "qrcode";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { crearSesionPortal, tieneSesionPortal } from "@/lib/portal/sesion";

type R = { error: string | null; ok?: boolean };

// ---------- ADMIN: configurar / resetear el PIN de un cliente ----------
export async function configurarPinPortal(p: {
  clienteId: string;
  pin: string;
}): Promise<R> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo administradores." };

  if (!/^\d{4,8}$/.test(p.pin)) return { error: "El PIN debe ser de 4 a 8 dígitos." };

  const admin = createAdminClient();
  const hash = await bcrypt.hash(p.pin, 10);
  await admin.from("clientes").update({ portal_pin_hash: hash }).eq("id", p.clienteId);

  await admin.from("logs_auditoria").insert({
    usuario_id: user.id, usuario_email: user.email ?? "", accion: "UPDATE",
    tabla: "clientes", registro_id: p.clienteId,
    descripcion: "Configuración/reseteo del PIN de acceso al portal del cliente",
    valores_antes: null, valores_despues: null,
  });
  return { error: null, ok: true };
}

// ---------- ADMIN: desactivar el 2FA de un cliente (si perdió el teléfono) ----------
export async function resetearTotpPortal(p: { clienteId: string }): Promise<R> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida." };
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo administradores." };

  const admin = createAdminClient();
  await admin.from("clientes")
    .update({ portal_totp_secret: null, portal_totp_activo: false })
    .eq("id", p.clienteId);

  await admin.from("logs_auditoria").insert({
    usuario_id: user.id, usuario_email: user.email ?? "", accion: "UPDATE",
    tabla: "clientes", registro_id: p.clienteId,
    descripcion: "Reseteo del 2FA del portal del cliente (perdió el dispositivo)",
    valores_antes: null, valores_despues: null,
  });
  return { error: null, ok: true };
}

// ---------- PORTAL: ingresar con PIN (+ TOTP si está activo) ----------
export async function ingresarPortal(p: {
  token: string;
  pin: string;
  codigo?: string;
}): Promise<R> {
  const admin = createAdminClient();
  const { data: cli } = await admin
    .from("clientes")
    .select("id, portal_pin_hash, portal_totp_secret, portal_totp_activo")
    .eq("portal_token", p.token)
    .single();
  if (!cli) return { error: "Portal inválido." };
  if (!cli.portal_pin_hash) return { error: "Este portal todavía no tiene clave configurada. Contactá a tu gestor." };

  const okPin = await bcrypt.compare(p.pin, cli.portal_pin_hash);
  if (!okPin) return { error: "Clave incorrecta." };

  if (cli.portal_totp_activo && cli.portal_totp_secret) {
    if (!p.codigo || !/^\d{6}$/.test(p.codigo)) {
      return { error: "Ingresá el código de 6 dígitos de tu app de autenticación." };
    }
    const okTotp = (await verifyTotp({ secret: cli.portal_totp_secret, token: p.codigo })).valid;
    if (!okTotp) return { error: "Código de autenticación incorrecto o vencido." };
  }

  await crearSesionPortal(cli.id);
  return { error: null, ok: true };
}

// ---------- PORTAL: empezar setup de 2FA (genera secreto + QR) ----------
export async function iniciarTotpPortal(p: { token: string }): Promise<{ error: string | null; qr?: string; secret?: string }> {
  const admin = createAdminClient();
  const { data: cli } = await admin
    .from("clientes").select("id, razon_social").eq("portal_token", p.token).single();
  if (!cli) return { error: "Portal inválido." };
  if (!(await tieneSesionPortal(cli.id))) return { error: "Sesión vencida. Volvé a ingresar." };

  const secret = generateSecret();
  const otpauth = generateURI({ issuer: "GOAT Cobranzas", label: cli.razon_social, secret });
  const qr = await QRCode.toDataURL(otpauth);

  // Guardamos el secreto pero TODAVÍA no lo activamos (hasta que confirme un código)
  await admin.from("clientes").update({ portal_totp_secret: secret }).eq("id", cli.id);
  return { error: null, qr, secret };
}

// ---------- PORTAL: confirmar y activar 2FA ----------
export async function activarTotpPortal(p: { token: string; codigo: string }): Promise<R> {
  const admin = createAdminClient();
  const { data: cli } = await admin
    .from("clientes").select("id, portal_totp_secret").eq("portal_token", p.token).single();
  if (!cli) return { error: "Portal inválido." };
  if (!(await tieneSesionPortal(cli.id))) return { error: "Sesión vencida. Volvé a ingresar." };
  if (!cli.portal_totp_secret) return { error: "Primero generá el código QR." };

  if (!(await verifyTotp({ secret: cli.portal_totp_secret, token: p.codigo })).valid) {
    return { error: "El código no coincide. Revisá tu app de autenticación." };
  }
  await admin.from("clientes").update({ portal_totp_activo: true }).eq("id", cli.id);
  return { error: null, ok: true };
}

// ---------- PORTAL: desactivar el propio 2FA (cliente, ya logueado) ----------
export async function desactivarTotpPortal(p: { token: string }): Promise<R> {
  const admin = createAdminClient();
  const { data: cli } = await admin.from("clientes").select("id").eq("portal_token", p.token).single();
  if (!cli) return { error: "Portal inválido." };
  if (!(await tieneSesionPortal(cli.id))) return { error: "Sesión vencida." };
  await admin.from("clientes").update({ portal_totp_secret: null, portal_totp_activo: false }).eq("id", cli.id);
  return { error: null, ok: true };
}
