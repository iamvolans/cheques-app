"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { iniciarTotpPortal, activarTotpPortal, desactivarTotpPortal } from "@/actions/portal-seguridad";
import { ShieldCheck, ShieldPlus } from "lucide-react";

export default function Activar2FA({ token, activo }: { token: string; activo: boolean }) {
  const [abierto, setAbierto] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  if (activo) {
    return (
      <section className="rounded-2xl border border-emerald-800/40 bg-card/50 p-4">
        <div className="flex items-center justify-between gap-3">
          <p className="flex items-center gap-2 text-xs font-medium text-primary"><ShieldCheck size={15} /> Verificación en dos pasos activa</p>
          <button
            disabled={pendiente}
            onClick={() => {
              setError(null);
              startTransition(async () => {
                const r = await desactivarTotpPortal({ token });
                if (r.error) setError(r.error); else router.refresh();
              });
            }}
            className="rounded border border-border px-2 py-1 text-[10px] text-muted-foreground hover:bg-muted"
          >
            Desactivar
          </button>
        </div>
        {error && <p className="mt-2 text-xs text-danger">{error}</p>}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-border bg-card/50 p-4">
      {!abierto ? (
        <button onClick={() => {
          setAbierto(true); setError(null);
          startTransition(async () => {
            const r = await iniciarTotpPortal({ token });
            if (r.error) setError(r.error);
            else setQr(r.qr ?? null);
          });
        }} className="flex items-center gap-2 text-xs font-medium text-foreground/90">
          <ShieldPlus size={15} className="text-primary" /> Activar verificación en dos pasos (recomendado)
        </button>
      ) : (
        <div className="space-y-3">
          <p className="text-xs font-medium text-foreground/90">Escaneá el código con Google Authenticator</p>
          {pendiente && !qr && <p className="text-xs text-muted-foreground">Generando código…</p>}
          {qr && (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qr} alt="QR 2FA" className="mx-auto h-44 w-44 rounded-lg bg-white p-2" />
              <p className="text-[11px] text-muted-foreground">Después de escanearlo, ingresá el código de 6 dígitos para confirmar:</p>
              <div className="flex gap-2">
                <input
                  inputMode="numeric" maxLength={6} value={codigo}
                  onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
                  placeholder="Código" className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-center font-mono tracking-[0.2em] text-foreground outline-none focus:border-primary"
                />
                <button
                  disabled={pendiente || codigo.length !== 6}
                  onClick={() => {
                    setError(null);
                    startTransition(async () => {
                      const r = await activarTotpPortal({ token, codigo });
                      if (r.error) setError(r.error); else router.refresh();
                    });
                  }}
                  className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
                >
                  Confirmar
                </button>
              </div>
            </>
          )}
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>
      )}
    </section>
  );
}
