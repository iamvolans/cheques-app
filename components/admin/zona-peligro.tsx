"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";

export default function ZonaPeligro({
  titulo,
  descripcion,
  accion,
  destinoTrasEliminar,
}: {
  titulo: string;
  descripcion: string;
  accion: (codigo: string) => Promise<{ error: string | null; ok?: boolean }>;
  destinoTrasEliminar: string;
}) {
  const [abierto, setAbierto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  return (
    <section className="rounded-2xl border border-red-900/60 bg-red-950/20 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/10 text-red-400">
            <ShieldAlert size={18} />
          </span>
          <div>
            <p className="text-sm font-semibold text-red-300">Zona de peligro</p>
            <p className="text-xs text-zinc-500">{descripcion}</p>
          </div>
        </div>

        {!abierto ? (
          <button
            onClick={() => setAbierto(true)}
            className="rounded-lg border border-red-900 px-3 py-1.5 text-xs font-medium text-red-300 transition hover:bg-red-950"
          >
            {titulo}
          </button>
        ) : (
          <div className="flex flex-wrap items-center gap-2">
            <input
              inputMode="numeric"
              maxLength={6}
              placeholder="Código Authenticator"
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
              className="w-44 rounded-lg border border-red-900/70 bg-zinc-950 px-3 py-1.5 text-center font-mono text-sm tracking-[0.3em] text-zinc-100 outline-none transition placeholder:text-xs placeholder:tracking-normal placeholder:text-zinc-600 focus:border-red-500 focus:ring-2 focus:ring-red-500/15"
            />
            <button
              disabled={pendiente || codigo.length !== 6}
              onClick={() => {
                setError(null);
                startTransition(async () => {
                  const r = await accion(codigo);
                  if (r.error) setError(r.error);
                  else router.push(destinoTrasEliminar);
                });
              }}
              className="rounded-lg bg-red-700 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-red-600 disabled:opacity-50"
            >
              {pendiente ? "Verificando…" : "Eliminar definitivamente"}
            </button>
            <button
              onClick={() => { setAbierto(false); setCodigo(""); setError(null); }}
              className="rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 transition hover:bg-zinc-800"
            >
              Cancelar
            </button>
          </div>
        )}
      </div>
      {error && (
        <p className="mt-3 rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-xs text-red-300">
          {error}
        </p>
      )}
    </section>
  );
}
