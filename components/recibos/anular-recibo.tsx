"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { anularRecibo } from "@/actions/recibos";

export default function AnularRecibo({
  reciboId,
  numero,
}: {
  reciboId: string;
  numero: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  if (!abierto) {
    return (
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="rounded border border-red-600 px-3 py-1.5 text-xs font-medium text-red-700 transition hover:bg-red-50"
      >
        Anular recibo N° {numero}
      </button>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2 rounded border border-red-300 bg-red-50 p-3">
      <span className="text-xs text-red-800">
        Anular libera los cheques y los deja otra vez como rechazados.
      </span>
      <input
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        placeholder="Motivo de la anulación *"
        className="w-64 rounded border border-red-300 bg-white px-2 py-1 text-xs text-black outline-none"
      />
      <button
        type="button"
        disabled={pendiente || motivo.trim() === ""}
        onClick={() => {
          setErr(null);
          startTransition(async () => {
            const r = await anularRecibo(reciboId, motivo);
            if (r.error) { setErr(r.error); return; }
            router.refresh();
          });
        }}
        className="rounded bg-red-600 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
      >
        {pendiente ? "Anulando…" : "Confirmar anulación"}
      </button>
      <button
        type="button"
        onClick={() => setAbierto(false)}
        className="rounded border border-neutral-400 px-2 py-1.5 text-xs text-neutral-700"
      >
        Cancelar
      </button>
      {err && <span className="w-full text-xs text-red-700">{err}</span>}
    </div>
  );
}
