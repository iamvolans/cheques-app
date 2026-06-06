"use client";

import { useState, useTransition } from "react";
import { generarPortalToken, revocarPortalToken } from "@/actions/portal";
import { Link2, Copy, RefreshCw, Ban } from "lucide-react";

export default function PortalCliente({
  clienteId,
  token,
}: {
  clienteId: string;
  token: string | null;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tokenLocal, setTokenLocal] = useState(token);
  const [copiado, setCopiado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const url = tokenLocal ? `${typeof window !== "undefined" ? window.location.origin : ""}/portal/${tokenLocal}` : null;

  function generar() {
    setError(null);
    startTransition(async () => {
      const r = await generarPortalToken({ clienteId });
      if (r.error) setError(r.error);
      else setTokenLocal(r.token ?? null);
    });
  }

  function revocar() {
    setError(null);
    startTransition(async () => {
      const r = await revocarPortalToken({ clienteId });
      if (r.error) setError(r.error);
      else setTokenLocal(null);
    });
  }

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
      >
        <Link2 size={13} />
        Portal del cliente
        {tokenLocal && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />}
      </button>
    );
  }

  return (
    <div className="grid w-80 gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-3 text-left">
      <p className="text-xs font-medium text-zinc-300">Portal de autoconsulta</p>
      {tokenLocal ? (
        <>
          <p className="truncate rounded border border-zinc-800 bg-zinc-950 px-2 py-1.5 font-mono text-[10px] text-zinc-400">
            {url}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => {
                if (url) navigator.clipboard.writeText(url);
                setCopiado(true);
                setTimeout(() => setCopiado(false), 2000);
              }}
              className="inline-flex items-center gap-1 rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500"
            >
              <Copy size={12} /> {copiado ? "¡Copiado!" : "Copiar link"}
            </button>
            <button
              disabled={pendiente}
              onClick={generar}
              title="Genera un link nuevo; el anterior deja de funcionar"
              className="inline-flex items-center gap-1 rounded border border-zinc-700 px-2.5 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              <RefreshCw size={12} /> Regenerar
            </button>
            <button
              disabled={pendiente}
              onClick={revocar}
              className="inline-flex items-center gap-1 rounded border border-red-900 px-2.5 py-1.5 text-xs text-red-300 transition hover:bg-red-950 disabled:opacity-50"
            >
              <Ban size={12} /> Revocar
            </button>
          </div>
          <p className="text-[10px] text-zinc-500">
            Mandale el link al cliente (WhatsApp/email). Ve su saldo y valores en tiempo real, solo lectura.
            Regenerar o revocar mata el link anterior al instante.
          </p>
        </>
      ) : (
        <>
          <p className="text-[10px] text-zinc-500">El portal está desactivado para este cliente.</p>
          <button
            disabled={pendiente}
            onClick={generar}
            className="rounded bg-emerald-600 px-2.5 py-1.5 text-xs font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {pendiente ? "Generando…" : "Generar link del portal"}
          </button>
        </>
      )}
      {error && <p className="text-xs text-red-400">{error}</p>}
      <button onClick={() => setAbierto(false)} className="text-left text-[10px] text-zinc-500 hover:text-zinc-300">
        Cerrar
      </button>
    </div>
  );
}
