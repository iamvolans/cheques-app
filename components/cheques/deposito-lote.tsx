"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { depositarLote } from "@/actions/cheques";
import { Landmark } from "lucide-react";

export default function DepositoLote() {
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const router = useRouter();

  const toggleTodos = (checked: boolean) => {
    document.querySelectorAll<HTMLInputElement>('input[name="sel"]').forEach((c) => {
      c.checked = checked;
    });
  };

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card/50 px-4 py-3">
      <label className="flex items-center gap-2 text-xs text-muted-foreground">
        <input type="checkbox" onChange={(e) => toggleTodos(e.target.checked)} className="h-4 w-4 accent-emerald-600" />
        Seleccionar todos los de la página (en cartera)
      </label>
      <button
        type="button"
        disabled={pendiente}
        onClick={() => {
          const ids = Array.from(
            document.querySelectorAll<HTMLInputElement>('input[name="sel"]:checked')
          ).map((c) => c.value);
          setMsg(null);
          setErr(null);
          startTransition(async () => {
            const r = await depositarLote(ids);
            if (r.error) { setErr(r.error); return; }
            const partes = [`${r.ok} depositado${r.ok === 1 ? "" : "s"} ✓`];
            if (r.fallidos && r.fallidos.length > 0) {
              partes.push(`${r.fallidos.length} sin depositar: ${r.fallidos.map((x) => `N° ${x.numero} (${x.motivo})`).join(", ")}`);
            }
            setMsg(partes.join(" · "));
            router.refresh();
          });
        }}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-700 disabled:opacity-50"
      >
        <Landmark size={13} /> {pendiente ? "Depositando…" : "Depositar seleccionados"}
      </button>
      {msg && <span className="text-xs text-primary">{msg}</span>}
      {err && <span className="text-xs text-danger">{err}</span>}
    </div>
  );
}
