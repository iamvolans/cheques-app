"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { borrarArchivo } from "@/lib/google-drive/drive";

type Resultado = { error: string | null; ok?: boolean };

function idDesdeUrlDrive(url: string | null): string | null {
  if (!url) return null;
  const m = url.match(/\/d\/([^/]+)/);
  return m ? m[1] : null;
}

// Triple candado: sesión válida + rol admin + código TOTP fresco verificado contra Supabase
async function exigirAdminConTotp(
  codigo: string
): Promise<{ error: string } | { userId: string; email: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") {
    return { error: "Solo un Administrador puede eliminar registros." };
  }

  if (!/^\d{6}$/.test(codigo)) {
    return { error: "Ingresá el código de 6 dígitos de tu Google Authenticator." };
  }

  const { data: factores } = await supabase.auth.mfa.listFactors();
  const factor = factores?.totp?.[0];
  if (!factor) return { error: "No encontré tu factor MFA." };

  const { data: desafio, error: e1 } = await supabase.auth.mfa.challenge({
    factorId: factor.id,
  });
  if (e1 || !desafio) return { error: "No se pudo iniciar la verificación MFA." };

  const { error: e2 } = await supabase.auth.mfa.verify({
    factorId: factor.id,
    challengeId: desafio.id,
    code: codigo,
  });
  if (e2) return { error: "Código incorrecto o vencido. Verificación denegada." };

  return { userId: user.id, email: user.email ?? "" };
}

export async function eliminarCheque(input: {
  chequeId: string;
  codigo: string;
}): Promise<Resultado> {
  const auth = await exigirAdminConTotp(input.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: ch } = await admin
    .from("cheques").select("*").eq("id", input.chequeId).single();
  if (!ch) return { error: "El cheque no existe." };

  if (!["aceptado", "en_custodia"].includes(ch.estado)) {
    return {
      error: `Un cheque ${ch.estado} no se puede eliminar: ya impactó en los libros. La integridad contable es sagrada.`,
    };
  }

  // Borrar las fotos/PDF de Drive (si falla, no frena la eliminación)
  for (const url of [ch.foto_frente_url, ch.foto_dorso_url, ch.pdf_endoso_url]) {
    const id = idDesdeUrlDrive(url);
    if (id) {
      try { await borrarArchivo(id); } catch { /* archivo ya inexistente */ }
    }
  }

  // Registro permanente en auditoría con la foto completa de lo eliminado
  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId,
    usuario_email: auth.email,
    accion: "DELETE",
    tabla: "cheques",
    registro_id: ch.id,
    descripcion: `ELIMINACIÓN DEFINITIVA del cheque N° ${ch.numero_cheque} (${ch.librador}, $${ch.monto}) — verificada con segundo factor`,
    valores_antes: ch,
    valores_despues: null,
  });

  const { error } = await admin.from("cheques").delete().eq("id", ch.id);
  if (error) return { error: error.message };

  revalidatePath("/cheques");
  revalidatePath("/dashboard");
  return { error: null, ok: true };
}

export async function eliminarCliente(input: {
  clienteId: string;
  codigo: string;
}): Promise<Resultado> {
  const auth = await exigirAdminConTotp(input.codigo);
  if ("error" in auth) return { error: auth.error };

  const admin = createAdminClient();
  const { data: cli } = await admin
    .from("clientes").select("*").eq("id", input.clienteId).single();
  if (!cli) return { error: "El cliente no existe." };

  const [{ count: nCheques }, { count: nMovs }, { count: nLiqs }] = await Promise.all([
    admin.from("cheques").select("id", { count: "exact", head: true }).eq("cliente_id", cli.id),
    admin.from("movimientos_clientes").select("id", { count: "exact", head: true }).eq("cliente_id", cli.id),
    admin.from("liquidaciones").select("id", { count: "exact", head: true }).eq("cliente_id", cli.id),
  ]);

  if ((nCheques ?? 0) > 0 || (nMovs ?? 0) > 0 || (nLiqs ?? 0) > 0) {
    return {
      error: `Este cliente tiene historia (${nCheques ?? 0} cheques, ${nMovs ?? 0} movimientos, ${nLiqs ?? 0} liquidaciones) y no puede eliminarse. Solo se eliminan cuentas creadas por error, sin operación.`,
    };
  }

  await admin.from("logs_auditoria").insert({
    usuario_id: auth.userId,
    usuario_email: auth.email,
    accion: "DELETE",
    tabla: "clientes",
    registro_id: cli.id,
    descripcion: `ELIMINACIÓN DEFINITIVA del cliente ${cli.razon_social} (CUIT ${cli.cuit}) — sin operación registrada — verificada con segundo factor`,
    valores_antes: cli,
    valores_despues: null,
  });

  const { error } = await admin.from("clientes").delete().eq("id", cli.id);
  if (error) return { error: error.message };

  revalidatePath("/clientes");
  return { error: null, ok: true };
}
