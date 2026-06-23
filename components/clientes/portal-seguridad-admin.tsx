"use client";

import { useState, useTransition } from "react";
import { configurarPinPortal, resetearTotpPortal } from "@/actions/portal-seguridad";
import { KeyRound, ShieldOff } from "lucide-react";

export default function PortalSeguridadAdmin({
  clienteId,
  tieneTotp,
}: {
  clienteId: string;
  tieneTotp: boolean;
}) {
  const [abierto, setAbierto] = useState(false);
  const [pin, setPin] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const inp = "rounded-lg border border-border bg-background px-3 py-1.5 text-sm text-foreground outline-none focus:border-primary";

  if (!abierto) {
    return (
      <button onClick={() => setAbierto(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted">
        <KeyRound size={13} /> Seguridad del portal
      </button>
    );
  }

  return (
    <div className="grid w-80 gap-2 rounded-lg border border-border bg-card p-3 text-left">
      <p className="text-xs font-medium text-foreground/90">Seguridad del portal</p>
      <p className="text-[10px] text-muted-foreground">Configurá la clave de acceso (4 a 8 dígitos) y pasásela al cliente por un canal seguro. El cliente puede activar 2FA desde adentro.</p>

      <div className="flex gap-2">
        <input
          type="text" inputMode="numeric" maxLength={8} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          placeholder="Nueva clave (4-8 díg.)" className={`${inp} flex-1`}
        />
        <button
          disabled={pendiente || pin.length < 4}
          onClick={() => {
            setError(null); setMsg(null);
            startTransition(async () => {
              const r = await configurarPinPortal({ clienteId, pin });
              if (r.error) setError(r.error);
              else { setMsg(`Clave configurada: ${pin} (pasásela al cliente)`); setPin(""); }
            });
          }}
          className="rounded bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary/90 disabled:opacity-50"
        >
          {pendiente ? "…" : "Guardar"}
        </button>
      </div>

      <div className="flex items-center justify-between rounded-lg border border-border-subtle px-2.5 py-2">
        <span className="text-[11px] text-muted-foreground">2FA del cliente: <span className={tieneTotp ? "text-primary" : "text-muted-foreground"}>{tieneTotp ? "activo" : "inactivo"}</span></span>
        {tieneTotp && (
          <button
            disabled={pendiente}
            onClick={() => {
              setError(null); setMsg(null);
              startTransition(async () => {
                const r = await resetearTotpPortal({ clienteId });
                if (r.error) setError(r.error);
                else setMsg("2FA reseteado. El cliente puede volver a configurarlo.");
              });
            }}
            className="inline-flex items-center gap-1 rounded border border-danger/40 px-2 py-1 text-[10px] text-danger hover:bg-danger-muted disabled:opacity-50"
          >
            <ShieldOff size={11} /> Resetear 2FA
          </button>
        )}
      </div>

      {msg && <p className="rounded border border-primary/40 bg-success-muted px-2 py-1.5 text-[11px] text-primary">{msg}</p>}
      {error && <p className="text-xs text-danger">{error}</p>}
      <button onClick={() => { setAbierto(false); setMsg(null); setError(null); }} className="text-left text-[10px] text-muted-foreground hover:text-foreground/90">Cerrar</button>
    </div>
  );
}
