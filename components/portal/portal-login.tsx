"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ingresarPortal } from "@/actions/portal-seguridad";
import { Lock } from "lucide-react";

export default function PortalLogin({ token, pide2fa }: { token: string; pide2fa: boolean }) {
  const [pin, setPin] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  const inp = "w-full rounded-lg border border-border bg-background px-3 py-2 text-center font-mono text-lg tracking-[0.3em] text-foreground outline-none focus:border-primary";

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4 text-foreground">
      <div className="w-full max-w-xs space-y-4">
        <div className="flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary"><Lock size={22} /></span>
          <div>
            <p className="text-sm font-semibold">Portal de cuenta</p>
            <p className="text-xs text-muted-foreground">Ingresá tu clave para continuar</p>
          </div>
        </div>

        <input
          type="password" inputMode="numeric" maxLength={8} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Clave" className={inp} autoFocus
        />
        {pide2fa && (
          <input
            inputMode="numeric" maxLength={6} value={codigo}
            onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
            placeholder="Código 2FA" className={inp}
          />
        )}
        {error && <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-center text-xs text-danger">{error}</p>}
        <button
          disabled={pendiente || pin.length < 4}
          onClick={() => {
            setError(null);
            startTransition(async () => {
              const r = await ingresarPortal({ token, pin, codigo: pide2fa ? codigo : undefined });
              if (r.error) setError(r.error);
              else router.refresh();
            });
          }}
          className="w-full rounded-lg bg-primary py-2 text-sm font-medium text-white transition hover:bg-primary/90 disabled:opacity-50"
        >
          {pendiente ? "Verificando…" : "Ingresar"}
        </button>
        <p className="text-center text-[10px] text-muted-foreground">Si olvidaste tu clave, contactá a tu gestor.</p>
      </div>
    </main>
  );
}
