"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaVerifyPage() {
  const router = useRouter();
  const supabase = createClient();

  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  async function verificar() {
    if (codigo.length !== 6) return;
    setVerificando(true);
    setError(null);

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError(
        "DIAGNÓSTICO: el navegador no encuentra la sesión. Avisale a Claude."
      );
      setVerificando(false);
      return;
    }

    const { data: factores, error: errF } =
      await supabase.auth.mfa.listFactors();
    const factor = factores?.totp?.find((f) => f.status === "verified");

    if (errF || !factor) {
      router.replace("/mfa-setup");
      return;
    }

    const { data: challenge, error: errC } = await supabase.auth.mfa.challenge(
      { factorId: factor.id }
    );
    if (errC) {
      setError("Error en challenge: " + errC.message);
      setVerificando(false);
      return;
    }

    const { error: errV } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: codigo,
    });

    if (errV) {
      setError("Código incorrecto o vencido. Ingresá el código actual.");
      setVerificando(false);
      setCodigo("");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  async function salir() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Verificación en dos pasos
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Ingresá el código de Google Authenticator
          </p>
        </div>

        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <input
            inputMode="numeric"
            maxLength={6}
            autoFocus
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            onKeyDown={(e) => e.key === "Enter" && verificar()}
            placeholder="000000"
            className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-center font-mono text-2xl tracking-[0.5em] text-zinc-100 outline-none placeholder:text-zinc-700 focus:border-emerald-500"
          />

          {error && (
            <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
              {error}
            </p>
          )}

          <button
            onClick={verificar}
            disabled={verificando || codigo.length !== 6}
            className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {verificando ? "Verificando…" : "Verificar"}
          </button>

          <button
            onClick={salir}
            className="w-full text-center text-xs text-zinc-500 transition hover:text-zinc-300"
          >
            Cancelar y volver al login
          </button>
        </div>
      </div>
    </main>
  );
}
