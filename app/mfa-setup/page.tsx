"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function MfaSetupPage() {
  const router = useRouter();
  const supabase = createClient();
  const inicializado = useRef(false);

  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [secreto, setSecreto] = useState<string | null>(null);
  const [factorId, setFactorId] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (inicializado.current) return;
    inicializado.current = true;

    async function iniciar() {
      // Diagnóstico: ¿el navegador ve la sesión?
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError(
          "DIAGNÓSTICO: el navegador no encuentra la sesión (cookies no accesibles). Avisale a Claude con este mensaje."
        );
        return;
      }

      // Si ya tiene un factor verificado, no corresponde estar acá
      const { data: factores } = await supabase.auth.mfa.listFactors();
      const verificado = factores?.totp?.find((f) => f.status === "verified");
      if (verificado) {
        router.replace("/mfa-verify");
        return;
      }

      // Limpia enrolamientos a medias de intentos anteriores
      const pendientes =
        factores?.all?.filter((f) => f.status === "unverified") ?? [];
      for (const p of pendientes) {
        await supabase.auth.mfa.unenroll({ factorId: p.id });
      }

      const { data, error: errE } = await supabase.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "Google Authenticator",
      });

      if (errE) {
        setError("No se pudo iniciar el enrolamiento: " + errE.message);
        return;
      }

      setFactorId(data.id);
      setQrUrl(data.totp.qr_code); // data URI listo para usar en <img>
      setSecreto(data.totp.secret);
    }

    iniciar();
  }, [router, supabase]);

  async function verificar() {
    if (!factorId || codigo.length !== 6) return;
    setVerificando(true);
    setError(null);

    // Refresca la sesión por si el token venció mientras escaneabas
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      setError(
        "DIAGNÓSTICO: se perdió la sesión del navegador antes de verificar. Avisale a Claude."
      );
      setVerificando(false);
      return;
    }

    const { data: challenge, error: errC } = await supabase.auth.mfa.challenge(
      { factorId }
    );
    if (errC) {
      setError("Error en challenge: " + errC.message);
      setVerificando(false);
      return;
    }

    const { error: errV } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code: codigo,
    });

    if (errV) {
      setError("Código incorrecto o vencido. Probá con el código actual.");
      setVerificando(false);
      setCodigo("");
      return;
    }

    router.replace("/dashboard");
    router.refresh();
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4 py-8">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Activar segundo factor
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Obligatorio para proteger la operación financiera
          </p>
        </div>

        <div className="space-y-5 rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <ol className="list-inside list-decimal space-y-1 text-sm text-zinc-300">
            <li>
              Instalá <strong>Google Authenticator</strong> en tu teléfono
            </li>
            <li>Escaneá este código QR desde la app</li>
            <li>Ingresá el código de 6 dígitos que te muestra</li>
          </ol>

          {qrUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={qrUrl}
              alt="Código QR para Google Authenticator"
              className="mx-auto w-48 rounded-lg bg-white p-3"
            />
          ) : (
            !error && (
              <p className="text-center text-sm text-zinc-500">
                Generando código QR…
              </p>
            )
          )}

          {secreto && (
            <p className="break-all text-center text-xs text-zinc-500">
              ¿No podés escanear? Clave manual:{" "}
              <span className="font-mono text-zinc-400">{secreto}</span>
            </p>
          )}

          <input
            inputMode="numeric"
            maxLength={6}
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
            {verificando ? "Verificando…" : "Activar MFA"}
          </button>
        </div>
      </div>
    </main>
  );
}
