"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { actualizarUmbralesPlaft } from "@/actions/plaft";

export default function UmbralesPlaft({ fisica, juridica }: { fisica: number; juridica: number }) {
  const [vFisica, setVFisica] = useState(String(fisica));
  const [vJuridica, setVJuridica] = useState(String(juridica));
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const router = useRouter();

  const inp = "w-40 rounded border border-border bg-background px-2 py-1.5 text-xs text-foreground outline-none focus:border-primary";

  return (
    <div className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Persona física · ARS/mes
        <input type="number" min="1" step="1000" value={vFisica} onChange={(e) => setVFisica(e.target.value)} className={inp} />
      </label>
      <label className="flex flex-col gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        Empresa · ARS/mes
        <input type="number" min="1" step="1000" value={vJuridica} onChange={(e) => setVJuridica(e.target.value)} className={inp} />
      </label>
      <button
        disabled={pendiente}
        onClick={() => {
          setMsg(null);
          startTransition(async () => {
            const r = await actualizarUmbralesPlaft({ fisica: Number(vFisica) || 0, juridica: Number(vJuridica) || 0 });
            setMsg(r.error ?? "✓ Guardado");
            if (!r.error) { router.refresh(); setTimeout(() => setMsg(null), 2500); }
          });
        }}
        className="rounded bg-muted px-3 py-1.5 text-xs text-foreground transition hover:bg-muted disabled:opacity-50"
      >
        Guardar umbrales
      </button>
      {msg && <span className={`text-xs ${msg.startsWith("✓") ? "text-primary" : "text-danger"}`}>{msg}</span>}
    </div>
  );
}
