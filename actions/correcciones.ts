"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type R = { error: string | null; ok?: boolean };

async function exigirAdminConTotp(
  codigo: string
): Promise<{ error: string } | { userId: string; email: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo un Administrador puede corregir registros." };

  if (!/^\d{6}$/.test(codigo)) return { error: "Ingresá el código de 6 dígitos de tu Authenticator." };

  const { data: factores } = await supabase.auth.mfa.listFactors();
  const factor = factores?.totp?.[0];
  if (!factor) return { error: "No encontré tu factor MFA." };

  const { data: desafio, error: e1 } = await supabase.auth.mfa.challenge({ factorId: factor.id });
  if (e1 || !desafio) return { error: "No se pudo iniciar la verificación MFA." };

  const { error: e2 } = await supabase.auth.mfa.verify({
    factorId: factor.id, challengeId: desafio.id, code: codigo,
  });
  if (e2) return { error: "Código incorrecto o vencido. Verificación denegada." };

  return { userId: user.id, email: user.email ?? "" };
}

// ---------- Liquidaciones ----------

export async function corregirLiquidacion(p: {
  liquidacionId: string;
  nuevoMonto: number;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };
  if (!(p.nuevoMonto > 0)) return { error: "El monto debe ser mayor a 0." };

  const admin = createAdminClient();
  const { data: liq } = await admin.from("liquidaciones").select("*").eq("id", p.liquidacionId).single();
  if (!liq) return { error: "La liquidación no existe." };

  // Saldo del cliente sin contar esta liquidación
  const { data: movs } = await admin
    .from("movimientos_clientes").select("monto").eq("cliente_id", liq.cliente_id);
  const saldoActual = (movs ?? []).reduce((a, m) => a + Number(m.monto), 0);
  const base = saldoActual + Number(liq.monto_liquidado);
  if (p.nuevoMonto > base) {
    return { error: `El nuevo monto supera el disponible del cliente ($${base.toLocaleString("es-AR")}).` };
  }

  await admin.from("liquidaciones").update({ monto_liquidado: p.nuevoMonto }).eq("id", liq.id);
  await admin.from("movimientos_clientes").update({ monto: -p.nuevoMonto }).eq("liquidacion_id", liq.id);

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "UPDATE",
    tabla: "liquidaciones", registro_id: liq.id,
    descripcion: `Corrección de liquidación ${liq.coelsa_id}: $${liq.monto_liquidado} → $${p.nuevoMonto} (verificada con segundo factor)`,
    valores_antes: liq, valores_despues: { ...liq, monto_liquidado: p.nuevoMonto },
  });

  revalidatePath("/liquidaciones");
  revalidatePath("/clientes");
  return { error: null, ok: true };
}

export async function anularLiquidacion(p: {
  liquidacionId: string;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: liq } = await admin.from("liquidaciones").select("*").eq("id", p.liquidacionId).single();
  if (!liq) return { error: "La liquidación no existe." };

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "DELETE",
    tabla: "liquidaciones", registro_id: liq.id,
    descripcion: `ANULACIÓN de liquidación ${liq.coelsa_id} por $${liq.monto_liquidado} a ${liq.beneficiario} — saldo devuelto (verificada con segundo factor)`,
    valores_antes: liq, valores_despues: null,
  });

  // Si vino de una solicitud del portal, la devolvemos a pendiente
  await admin.from("solicitudes_liquidacion")
    .update({ estado: "pendiente", liquidacion_id: null, updated_at: new Date().toISOString() })
    .eq("liquidacion_id", liq.id);
  await admin.from("movimientos_clientes").delete().eq("liquidacion_id", liq.id);
  await admin.from("liquidaciones").delete().eq("id", liq.id);

  revalidatePath("/liquidaciones");
  revalidatePath("/clientes");
  return { error: null, ok: true };
}

// ---------- Cheques ----------

export async function corregirCheque(p: {
  chequeId: string;
  nuevoMonto: number;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };
  if (!(p.nuevoMonto > 0)) return { error: "El monto debe ser mayor a 0." };

  const admin = createAdminClient();
  const { data: ch } = await admin.from("cheques").select("*").eq("id", p.chequeId).single();
  if (!ch) return { error: "El cheque no existe." };
  if (ch.estado === "rechazado") {
    return { error: "No se puede corregir un cheque rechazado desde aquí (tiene débitos asociados). Consultá soporte." };
  }

  const pct = Number(ch.fee_aplicado_pct);
  const nuevoFee = Math.round(p.nuevoMonto * pct) / 100;

  if (ch.estado === "procesado") {
    const { data: movs } = await admin
      .from("movimientos_clientes").select("monto").eq("cliente_id", ch.cliente_id);
    const saldoActual = (movs ?? []).reduce((a, m) => a + Number(m.monto), 0);
    const acredVieja = Number(ch.monto) - Number(ch.fee_calculado);
    const acredNueva = p.nuevoMonto - nuevoFee;
    if (saldoActual - acredVieja + acredNueva < 0) {
      return { error: "La corrección dejaría el saldo del cliente en negativo (ya liquidó parte de este valor)." };
    }
  }

  await admin.from("cheques").update({ monto: p.nuevoMonto, fee_calculado: nuevoFee }).eq("id", ch.id);

  if (ch.estado === "procesado") {
    await admin.from("movimientos_clientes")
      .update({
        monto: p.nuevoMonto - nuevoFee,
        descripcion: `Acreditación cheque N° ${ch.numero_cheque} (monto ${p.nuevoMonto} - fee ${nuevoFee})`,
      })
      .eq("cheque_id", ch.id).eq("tipo", "acreditacion");
  }

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "UPDATE",
    tabla: "cheques", registro_id: ch.id,
    descripcion: `Corrección de cheque N° ${ch.numero_cheque}: monto $${ch.monto} → $${p.nuevoMonto}, fee $${ch.fee_calculado} → $${nuevoFee} (verificada con segundo factor)`,
    valores_antes: ch, valores_despues: { ...ch, monto: p.nuevoMonto, fee_calculado: nuevoFee },
  });

  revalidatePath("/cheques");
  revalidatePath(`/cheques/${ch.id}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}
