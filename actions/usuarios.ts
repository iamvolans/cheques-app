"use server";

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
import { z } from "zod";

// Verifica que quien llama sea un administrador con sesión válida.
async function exigirAdmin(): Promise<{ userId: string } | { error: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sesión vencida. Recargá la página." };

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("rol")
    .eq("id", user.id)
    .single();

  if (perfil?.rol !== "administrador") {
    return { error: "Solo un Administrador puede gestionar usuarios." };
  }
  return { userId: user.id };
}

const esquemaUsuario = z.object({
  nombre: z.string().min(2, "Falta el nombre"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña temporal debe tener al menos 8 caracteres"),
  rol: z.enum(["operador", "administrador"]),
});

export type EstadoUsuario = { error: string | null; ok?: boolean };

export async function crearUsuario(
  _prev: EstadoUsuario,
  formData: FormData
): Promise<EstadoUsuario> {
  const auth = await exigirAdmin();
  if ("error" in auth) return { error: auth.error };

  const datos = esquemaUsuario.safeParse(Object.fromEntries(formData));
  if (!datos.success) return { error: datos.error.issues[0].message };

  const admin = createAdminClient();
  const { data: creado, error } = await admin.auth.admin.createUser({
    email: datos.data.email,
    password: datos.data.password,
    email_confirm: true,
    user_metadata: { nombre: datos.data.nombre },
  });

  if (error) {
    return { error: "No se pudo crear: " + error.message };
  }

  // El trigger ya creó el perfil como operador; si pidieron admin, lo ascendemos.
  if (datos.data.rol === "administrador" && creado.user) {
    await admin
      .from("perfiles")
      .update({ rol: "administrador" })
      .eq("id", creado.user.id);
  }

  revalidatePath("/admin/usuarios");
  return { error: null, ok: true };
}

export async function cambiarRol(input: {
  usuarioId: string;
  nuevoRol: "operador" | "administrador";
}): Promise<{ error: string | null }> {
  const auth = await exigirAdmin();
  if ("error" in auth) return { error: auth.error };

  if (input.usuarioId === auth.userId && input.nuevoRol !== "administrador") {
    return { error: "No podés quitarte el rol de administrador a vos mismo." };
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("perfiles")
    .update({ rol: input.nuevoRol })
    .eq("id", input.usuarioId);

  if (error) return { error: error.message };
  revalidatePath("/admin/usuarios");
  return { error: null };
}

export async function cambiarActivo(input: {
  usuarioId: string;
  activo: boolean;
}): Promise<{ error: string | null }> {
  const auth = await exigirAdmin();
  if ("error" in auth) return { error: auth.error };

  if (input.usuarioId === auth.userId && !input.activo) {
    return { error: "No podés desactivar tu propia cuenta." };
  }

  const admin = createAdminClient();

  // Bloqueo real del login: ban en Supabase Auth (100 años) o desbloqueo.
  const { error: errBan } = await admin.auth.admin.updateUserById(
    input.usuarioId,
    { ban_duration: input.activo ? "none" : "876000h" }
  );
  if (errBan) return { error: errBan.message };

  const { error } = await admin
    .from("perfiles")
    .update({ activo: input.activo })
    .eq("id", input.usuarioId);

  if (error) return { error: error.message };
  revalidatePath("/admin/usuarios");
  return { error: null };
}
