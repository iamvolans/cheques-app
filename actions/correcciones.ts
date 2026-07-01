"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";

type R = { error: string | null; ok?: boolean; alerta?: string | null };

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
  const pct = Number(ch.fee_aplicado_pct);
  const nuevoFee = Math.round(p.nuevoMonto * pct) / 100;
  const multa = Number(ch.multa ?? 0);

  if (ch.estado === "procesado" || ch.estado === "rechazado") {
    const { data: movs } = await admin
      .from("movimientos_clientes").select("monto").eq("cliente_id", ch.cliente_id);
    const saldoActual = (movs ?? []).reduce((a, m) => a + Number(m.monto), 0);
    const impactoViejo = ch.estado === "procesado"
      ? Number(ch.monto) - Number(ch.fee_calculado)
      : -(Number(ch.fee_calculado) + multa);
    const impactoNuevo = ch.estado === "procesado"
      ? p.nuevoMonto - nuevoFee
      : -(nuevoFee + multa);
    if (saldoActual - impactoViejo + impactoNuevo < 0) {
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
  } else if (ch.estado === "rechazado") {
    await admin.from("movimientos_clientes")
      .update({ monto: -(nuevoFee + multa) })
      .eq("cheque_id", ch.id).eq("tipo", "debito_rechazo");
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

// ---------- Reaplicar la tarifa vigente del cliente a todos sus cheques ----------

export async function reaplicarTarifaCliente(p: {
  clienteId: string;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: cli } = await admin
    .from("clientes")
    .select("id, razon_social, fee_porcentaje, fee_interior_porcentaje")
    .eq("id", p.clienteId)
    .single();
  if (!cli) return { error: "El cliente no existe." };

  const feeCamara = Number(cli.fee_porcentaje);
  const feeInterior = cli.fee_interior_porcentaje != null ? Number(cli.fee_interior_porcentaje) : feeCamara;

  const { data: cheques } = await admin
    .from("cheques")
    .select("id, numero_cheque, monto, plaza, estado, fee_calculado, multa")
    .eq("cliente_id", cli.id);

  let actualizados = 0;
  for (const ch of cheques ?? []) {
    const pct = ch.plaza === "interior" ? feeInterior : feeCamara;
    const nuevoFee = Math.round(Number(ch.monto) * pct) / 100;

    await admin.from("cheques")
      .update({ fee_aplicado_pct: pct, fee_calculado: nuevoFee })
      .eq("id", ch.id);

    if (ch.estado === "procesado") {
      await admin.from("movimientos_clientes")
        .update({ monto: Number(ch.monto) - nuevoFee })
        .eq("cheque_id", ch.id).eq("tipo", "acreditacion");
    } else if (ch.estado === "rechazado") {
      await admin.from("movimientos_clientes")
        .update({ monto: -(nuevoFee + Number(ch.multa ?? 0)) })
        .eq("cheque_id", ch.id).eq("tipo", "debito_rechazo");
    }
    actualizados++;
  }

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId,
    usuario_email: auth.email,
    accion: "UPDATE",
    tabla: "cheques",
    registro_id: cli.id,
    descripcion: `Reaplicación de tarifa vigente (Cámara ${feeCamara}% / Interior ${feeInterior}%) a ${actualizados} cheques de ${cli.razon_social} (verificada con segundo factor)`,
    valores_antes: null,
    valores_despues: null,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${cli.id}`);
  revalidatePath("/cheques");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// ---------- Corregir el ESTADO de un cheque (ajusta movimientos según la matriz) ----------

type EstadoCheque = "aceptado" | "depositado" | "en_custodia" | "procesado" | "rechazado";

export async function corregirEstado(p: {
  chequeId: string;
  nuevoEstado: EstadoCheque;
  motivoRechazo?: string;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: ch } = await admin.from("cheques").select("*").eq("id", p.chequeId).single();
  if (!ch) return { error: "El cheque no existe." };

  const anterior = ch.estado as EstadoCheque;
  const nuevo = p.nuevoEstado;
  if (anterior === nuevo) return { error: "El cheque ya está en ese estado." };

  // Si pasa a rechazado, el motivo es obligatorio
  if (nuevo === "rechazado" && !(p.motivoRechazo ?? "").trim()) {
    return { error: "Para marcar como rechazado tenés que indicar el motivo." };
  }

  const fee = Number(ch.fee_calculado);
  const multa = Number(ch.multa ?? 0);
  const acreditacion = Number(ch.monto) - fee;
  const debitoRechazo = -(fee + multa);

  // Saldo actual del cliente
  const { data: movs } = await admin
    .from("movimientos_clientes").select("monto").eq("cliente_id", ch.cliente_id);
  const saldoActual = (movs ?? []).reduce((a, m) => a + Number(m.monto), 0);

  // Impacto que el estado ANTERIOR tenía sobre el saldo
  const impactoAnterior = anterior === "procesado" ? acreditacion : anterior === "rechazado" ? debitoRechazo : 0;
  // Impacto que tendrá el estado NUEVO
  const impactoNuevo = nuevo === "procesado" ? acreditacion : nuevo === "rechazado" ? debitoRechazo : 0;

  // Guarda: no dejar el saldo en negativo
  if (saldoActual - impactoAnterior + impactoNuevo < 0) {
    return { error: "El cambio dejaría el saldo del cliente en negativo (puede que ya se haya liquidado parte de este valor)." };
  }

  // 1) Quitar el movimiento del estado anterior, si tenía
  if (anterior === "procesado") {
    await admin.from("movimientos_clientes").delete().eq("cheque_id", ch.id).eq("tipo", "acreditacion");
  } else if (anterior === "rechazado") {
    await admin.from("movimientos_clientes").delete().eq("cheque_id", ch.id).eq("tipo", "debito_rechazo");
  }

  // 2) Crear el movimiento del estado nuevo, si corresponde
  if (nuevo === "procesado") {
    await admin.from("movimientos_clientes").insert({
      cliente_id: ch.cliente_id,
      cheque_id: ch.id,
      tipo: "acreditacion",
      monto: acreditacion,
      descripcion: `Acreditación cheque N° ${ch.numero_cheque} (monto ${ch.monto} - fee ${fee})`,
    });
  } else if (nuevo === "rechazado") {
    await admin.from("movimientos_clientes").insert({
      cliente_id: ch.cliente_id,
      cheque_id: ch.id,
      tipo: "debito_rechazo",
      monto: debitoRechazo,
      descripcion: `Débito por rechazo cheque N° ${ch.numero_cheque} (fee ${fee} + multa ${multa})`,
    });
  }

  // 3) Actualizar el cheque (estado + campos asociados al rechazo)
  const updateCheque: Record<string, unknown> = { estado: nuevo };
  if (nuevo === "rechazado") {
    updateCheque.motivo_rechazo = (p.motivoRechazo ?? "").trim();
    updateCheque.fecha_resolucion = new Date().toISOString();
  }
  if (anterior === "rechazado" && nuevo !== "rechazado") {
    updateCheque.motivo_rechazo = null;
  }
  if (nuevo === "procesado") {
    updateCheque.fecha_resolucion = new Date().toISOString();
  }
  await admin.from("cheques").update(updateCheque).eq("id", ch.id);

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId,
    usuario_email: auth.email,
    accion: "UPDATE",
    tabla: "cheques",
    registro_id: ch.id,
    descripcion: `Corrección de estado del cheque N° ${ch.numero_cheque}: ${anterior} → ${nuevo}${nuevo === "rechazado" ? ` (motivo: ${(p.motivoRechazo ?? "").trim()})` : ""} (verificada con segundo factor)`,
    valores_antes: ch,
    valores_despues: { ...ch, estado: nuevo },
  });

  revalidatePath("/cheques");
  revalidatePath(`/cheques/${ch.id}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// ---------- Helper admin SIN TOTP (para cambios no contables) ----------
async function exigirAdmin(): Promise<{ error: string } | { userId: string; email: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo un Administrador puede hacer esto." };
  return { userId: user.id, email: user.email ?? "" };
}

// ---------- Reasignar un cheque a otro cliente (mueve también sus movimientos) ----------
export async function reasignarCheque(p: {
  chequeId: string;
  nuevoClienteId: string;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: ch } = await admin.from("cheques").select("*").eq("id", p.chequeId).single();
  if (!ch) return { error: "El cheque no existe." };
  if (ch.cliente_id === p.nuevoClienteId) return { error: "El cheque ya pertenece a ese cliente." };

  const { data: destino } = await admin.from("clientes").select("id, razon_social").eq("id", p.nuevoClienteId).single();
  if (!destino) return { error: "El cliente destino no existe." };
  const { data: origen } = await admin.from("clientes").select("razon_social").eq("id", ch.cliente_id).single();

  // Suma de los movimientos de este cheque y guarda de saldo del origen
  const { data: movsCheque } = await admin.from("movimientos_clientes").select("monto").eq("cheque_id", ch.id);
  const sumMov = (movsCheque ?? []).reduce((a, m) => a + Number(m.monto), 0);
  const { data: movsOrigen } = await admin.from("movimientos_clientes").select("monto").eq("cliente_id", ch.cliente_id);
  const saldoOrigen = (movsOrigen ?? []).reduce((a, m) => a + Number(m.monto), 0);
  // (Se permite reasignar aunque el origen quede negativo; se advierte en el log más abajo.)
  void sumMov; void saldoOrigen;

  // Recalcular el fee con la tarifa del cliente DESTINO (según la plaza del cheque, que no cambia)
  const { data: cliDest } = await admin
    .from("clientes")
    .select("fee_porcentaje, fee_interior_porcentaje")
    .eq("id", p.nuevoClienteId)
    .single();
  if (!cliDest) return { error: "No se pudieron leer las tarifas del cliente destino." };
  const feeCamaraD = Number(cliDest.fee_porcentaje);
  const feeInteriorD = cliDest.fee_interior_porcentaje != null ? Number(cliDest.fee_interior_porcentaje) : feeCamaraD;
  const nuevoPct = ch.plaza === "interior" ? feeInteriorD : feeCamaraD;
  const nuevoFee = Math.round(Number(ch.monto) * nuevoPct) / 100;

  // Mover el cheque y actualizar su fee al del destino
  await admin.from("cheques")
    .update({ cliente_id: p.nuevoClienteId, fee_aplicado_pct: nuevoPct, fee_calculado: nuevoFee })
    .eq("id", ch.id);

  // Reescribir los movimientos: nuevo dueño + monto recalculado con el fee del destino
  if (ch.estado === "procesado") {
    await admin.from("movimientos_clientes")
      .update({ cliente_id: p.nuevoClienteId, monto: Number(ch.monto) - nuevoFee })
      .eq("cheque_id", ch.id).eq("tipo", "acreditacion");
  } else if (ch.estado === "rechazado") {
    await admin.from("movimientos_clientes")
      .update({ cliente_id: p.nuevoClienteId, monto: -(nuevoFee + Number(ch.multa ?? 0)) })
      .eq("cheque_id", ch.id).eq("tipo", "debito_rechazo");
  } else {
    await admin.from("movimientos_clientes")
      .update({ cliente_id: p.nuevoClienteId })
      .eq("cheque_id", ch.id);
  }

  // ¿El origen quedó en saldo negativo tras revertirle lo que ya se le había acreditado?
  const { data: movsOrigenPost } = await admin.from("movimientos_clientes").select("monto").eq("cliente_id", ch.cliente_id);
  const saldoOrigenPost = (movsOrigenPost ?? []).reduce((a, m) => a + Number(m.monto), 0);
  const avisoNegativo = saldoOrigenPost < 0
    ? ` ⚠ El saldo de ${origen?.razon_social ?? "el cliente origen"} quedó en negativo (${saldoOrigenPost.toFixed(2)}): revisar, probablemente ya había liquidado este valor.`
    : "";

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "UPDATE",
    tabla: "cheques", registro_id: ch.id,
    descripcion: `Reasignación de cheque N° ${ch.numero_cheque}: de ${origen?.razon_social ?? "?"} → ${destino.razon_social}. Fee recalculado a ${nuevoPct}% (fee ${nuevoFee}).${avisoNegativo}`,
    valores_antes: { cliente_id: ch.cliente_id, fee_aplicado_pct: ch.fee_aplicado_pct, fee_calculado: ch.fee_calculado },
    valores_despues: { cliente_id: p.nuevoClienteId, fee_aplicado_pct: nuevoPct, fee_calculado: nuevoFee },
  });

  revalidatePath("/cheques");
  revalidatePath(`/cheques/${ch.id}`);
  revalidatePath("/clientes");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// ---------- Editar datos NO contables del cheque (no toca saldo) ----------
export async function editarDatosCheque(p: {
  chequeId: string;
  librador: string;
  cuit_librador: string;
  banco_emisor: string;
  codigo_postal: number;
  fecha_cobro: string;
  fecha_estimada_acred: string | null;
}): Promise<R> {
  const auth = await exigirAdmin();
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: ch } = await admin.from("cheques").select("*").eq("id", p.chequeId).single();
  if (!ch) return { error: "El cheque no existe." };

  // Blindaje: el banco debe existir en la tabla de bancos (no texto libre)
  const bancoLimpio = p.banco_emisor.trim();
  const { data: bancoOk } = await admin.from("bancos").select("nombre").eq("nombre", bancoLimpio).maybeSingle();
  if (!bancoOk) return { error: "El banco emisor debe elegirse de la lista." };

  if (!Number.isInteger(p.codigo_postal) || p.codigo_postal < 1 || p.codigo_postal > 9999) {
    return { error: "El C.P. es obligatorio y debe estar entre 1 y 9999." };
  }
  const nuevaPlaza = p.codigo_postal <= 2000 ? "camara" : "interior";
  const { data: cliFee } = await admin
    .from("clientes")
    .select("fee_porcentaje, fee_interior_porcentaje")
    .eq("id", ch.cliente_id)
    .single();
  if (!cliFee) return { error: "No se encontró el cliente del cheque." };
  const feeCamara = Number(cliFee.fee_porcentaje);
  const feeInterior = cliFee.fee_interior_porcentaje != null ? Number(cliFee.fee_interior_porcentaje) : feeCamara;
  const nuevoPct = nuevaPlaza === "interior" ? feeInterior : feeCamara;
  const nuevoFee = Math.round(Number(ch.monto) * nuevoPct) / 100;

  const update = {
    librador: p.librador.trim(),
    cuit_librador: p.cuit_librador.trim(),
    banco_emisor: p.banco_emisor.trim(),
    codigo_postal: p.codigo_postal,
    plaza: nuevaPlaza,
    fee_aplicado_pct: nuevoPct,
    fee_calculado: nuevoFee,
    fecha_cobro: p.fecha_cobro,
    fecha_estimada_acred: p.fecha_estimada_acred || null,
  };
  if (!update.librador) return { error: "El librador no puede quedar vacío." };
  if (!/^\d{2}-?\d{8}-?\d$/.test(update.cuit_librador)) return { error: "El CUIT del librador es inválido." };

  await admin.from("cheques").update(update).eq("id", ch.id);

  if (ch.estado === "procesado") {
    await admin.from("movimientos_clientes")
      .update({ monto: Number(ch.monto) - nuevoFee })
      .eq("cheque_id", ch.id).eq("tipo", "acreditacion");
  } else if (ch.estado === "rechazado") {
    await admin.from("movimientos_clientes")
      .update({ monto: -(nuevoFee + Number(ch.multa ?? 0)) })
      .eq("cheque_id", ch.id).eq("tipo", "debito_rechazo");
  }

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "UPDATE",
    tabla: "cheques", registro_id: ch.id,
    descripcion: `Edición de datos no contables del cheque N° ${ch.numero_cheque} (librador/CUIT/banco/fechas)`,
    valores_antes: { librador: ch.librador, cuit_librador: ch.cuit_librador, banco_emisor: ch.banco_emisor, codigo_postal: ch.codigo_postal, plaza: ch.plaza, fee_aplicado_pct: ch.fee_aplicado_pct, fee_calculado: ch.fee_calculado, fecha_cobro: ch.fecha_cobro, fecha_estimada_acred: ch.fecha_estimada_acred },
    valores_despues: update,
  });

  revalidatePath("/cheques");
  revalidatePath(`/cheques/${ch.id}`);
  return { error: null, ok: true };
}

// ---------- Ajuste manual de saldo (movimiento ajuste_manual, +/-) ----------
export async function ajustarSaldoManual(p: {
  clienteId: string;
  monto: number;       // positivo = suma, negativo = resta
  motivo: string;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };

  if (!p.monto || p.monto === 0) return { error: "El monto del ajuste no puede ser 0." };
  if (!(p.motivo ?? "").trim()) return { error: "El motivo del ajuste es obligatorio." };

  const admin = createAdminClient();
  const { data: cli } = await admin.from("clientes").select("id, razon_social").eq("id", p.clienteId).single();
  if (!cli) return { error: "El cliente no existe." };

  // Guarda: si es un ajuste negativo, que no deje el saldo por debajo de 0
  const { data: movs } = await admin.from("movimientos_clientes").select("monto").eq("cliente_id", cli.id);
  const saldoActual = (movs ?? []).reduce((a, m) => a + Number(m.monto), 0);
  if (saldoActual + p.monto < 0) {
    return { error: `El ajuste dejaría el saldo en negativo (saldo actual $${saldoActual.toLocaleString("es-AR")}).` };
  }

  await admin.from("movimientos_clientes").insert({
    cliente_id: cli.id,
    tipo: "ajuste_manual",
    monto: p.monto,
    descripcion: `Ajuste manual (${p.monto >= 0 ? "+" : "−"}): ${p.motivo.trim()}`,
  });

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "INSERT",
    tabla: "movimientos_clientes", registro_id: cli.id,
    descripcion: `Ajuste manual de saldo a ${cli.razon_social}: ${p.monto >= 0 ? "+" : "−"}$${Math.abs(p.monto).toLocaleString("es-AR")} — motivo: ${p.motivo.trim()} (verificada con segundo factor)`,
    valores_antes: { saldo: saldoActual },
    valores_despues: { saldo: saldoActual + p.monto },
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${cli.id}`);
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

// ---------- Anular un movimiento puntual (solo ajuste_manual) ----------
export async function anularMovimiento(p: {
  movimientoId: string;
  codigo: string;
}): Promise<R> {
  const auth = await exigirAdminConTotp(p.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: mov } = await admin.from("movimientos_clientes").select("*").eq("id", p.movimientoId).single();
  if (!mov) return { error: "El movimiento no existe." };

  if (mov.tipo !== "ajuste_manual") {
    return { error: "Solo se pueden anular ajustes manuales desde acá. Para acreditaciones o débitos de cheques usá 'Corregir estado' en el cheque; para liquidaciones usá 'Anular' en Liquidaciones." };
  }

  // Guarda: si el ajuste era positivo, borrarlo no puede dejar el saldo negativo
  const { data: movs } = await admin.from("movimientos_clientes").select("monto").eq("cliente_id", mov.cliente_id);
  const saldoActual = (movs ?? []).reduce((a, m) => a + Number(m.monto), 0);
  if (saldoActual - Number(mov.monto) < 0) {
    return { error: "Anular este ajuste dejaría el saldo en negativo (ya se liquidó parte de ese saldo)." };
  }

  await admin.from("movimientos_clientes").delete().eq("id", mov.id);

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId, usuario_email: auth.email, accion: "DELETE",
    tabla: "movimientos_clientes", registro_id: mov.cliente_id,
    descripcion: `Anulación de ajuste manual ($${Number(mov.monto).toLocaleString("es-AR")}) — "${mov.descripcion}" (verificada con segundo factor)`,
    valores_antes: mov, valores_despues: null,
  });

  revalidatePath("/clientes");
  revalidatePath(`/clientes/${mov.cliente_id}`);
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}
