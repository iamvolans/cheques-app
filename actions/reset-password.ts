"use server";

import { randomBytes } from "node:crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function generarPassword(): string {
  const chars = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
  const b = randomBytes(12);
  let p = "";
  for (let i = 0; i < 12; i++) p += chars[b[i] % chars.length];
  return p;
}

export async function restablecerPassword(p: {
  userId: string;
}): Promise<{ error: string | null; password?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return { error: "Solo administradores." };
  if (p.userId === user.id) {
    return { error: "Para tu propia contraseña usá el flujo de tu cuenta, no este botón." };
  }

  const nueva = generarPassword();
  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(p.userId, { password: nueva });
  if (error) return { error: error.message };

  await admin.from("logs_auditoria").insert({
    usuario_id: user.id,
    usuario_email: user.email ?? "",
    accion: "UPDATE",
    tabla: "auth.users",
    registro_id: p.userId,
    descripcion: `Restablecimiento de contraseña del usuario ${p.userId}`,
    valores_antes: null,
    valores_despues: null,
  });

  return { error: null, password: nueva };
}
