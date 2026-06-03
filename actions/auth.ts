"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export type EstadoLogin = { error: string | null };

export async function login(
  _prevState: EstadoLogin,
  formData: FormData
): Promise<EstadoLogin> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "Completá email y contraseña." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "No se pudo iniciar sesión: " + error.message };
  }

  // ¿El usuario tiene MFA enrolado? Si sí, falta el segundo paso.
  const { data: aal } =
    await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

  if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
    redirect("/mfa-verify");
  }

  // Sin MFA enrolado: el dashboard lo va a mandar a /mfa-setup
  redirect("/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
