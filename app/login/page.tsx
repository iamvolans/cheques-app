"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, setPendiente] = useState(false);

  async function ingresar(e: React.FormEvent) {
    e.preventDefault();
    setPendiente(true);
    setError(null);

    const { error: errLogin } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (errLogin) {
      setError("No se pudo iniciar sesión: " + errLogin.message);
      setPendiente(false);
      return;
    }

    // ¿Tiene MFA enrolado? → pedir código. ¿No tiene? → dashboard lo manda a enrolar.
    const { data: aal } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();

    if (aal?.nextLevel === "aal2" && aal.currentLevel !== "aal2") {
      router.replace("/mfa-verify");
    } else {
      router.replace("/dashboard");
    }
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Gestión de Cobranza
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cheques físicos y E-Cheqs
          </p>
        </div>

        <form
          onSubmit={ingresar}
          className="space-y-4 rounded-xl border border-border bg-card p-6"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-foreground/90"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-foreground/90"
            >
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground/70 focus:border-primary"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-sm text-danger">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white transition hover:bg-primary disabled:opacity-50"
          >
            {pendiente ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
