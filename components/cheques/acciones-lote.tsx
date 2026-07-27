"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { depositarLote, acreditarLote, rechazarLote } from "@/actions/cheques";
import { Landmark, CheckCircle2, XCircle, ListChecks, Repeat2 } from "lucide-react";

export default function AccionesLote({ esAdmin }: { esAdmin: boolean }) {
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [multa, setMulta] = useState("");
  const [gasto, setGasto] = useState("");
  const [motivo, setMotivo] = useState("");
  const router = useRouter();

  const casillas = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sel"]'));
  const idsMarcados = () => casillas().filter((c) => c.checked).map((c) => c.value);
  const marcarTodos = () => casillas().forEach((c) => { c.checked = true; });
  const invertir = () => casillas().forEach((c) => { c.checked = !c.checked; });

  type Resultado = { error: string | null; ok?: number; fallidos?: { numero: string; motivo: string }[] };
  const procesarResultado = (r: Resultado, verbo: string) => {
    if (r.error) { setErr(r.error); return; }
    const partes = [String(r.ok) + " " + verbo];
    if (r.fallidos && r.fallidos.length > 0) {
      partes.push(
        r.fallidos.length + " omitido" + (r.fallidos.length === 1 ? "" : "s") + ": " +
        r.fallidos.map((x) => "N° " + x.numero + " (" + x.motivo + ")").join(", ")
      );
    }
    setMsg(partes.join(" · "));
    setRechazando(false);
    router.refresh();
  };

  const ejecutar = (accion: "depositar" | "acreditar" | "rechazar") => {
    const ids = idsMarcados();
    setMsg(null); setErr(null);
    startTransition(async () => {
      if (accion === "depositar") procesarResultado(await depositarLote(ids), "depositados ✓");
      if (accion === "acreditar") procesarResultado(await acreditarLote(ids), "acreditados ✓");
      if (accion === "rechazar") procesarResultado(await rechazarLote({
        ids,
        multa: Number(multa) || 0,
        gasto: gasto === "" ? null : Number(gasto) || 0,
        motivo,
      }), "rechazados ✓");
    });
  };

  const btnSel = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted";
  const inp = "w-40 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary";

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={marcarTodos} className={btnSel}>
          <ListChecks size={13} /> Seleccionar todos
        </button>
        <button type="button" onClick={invertir} className={btnSel}>
          <Repeat2 size={13} /> Invertir selección
        </button>
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          disabled={pendiente}
          onClick={() => ejecutar("depositar")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-700 disabled:opacity-50"
        >
          <Landmark size={13} /> Depositar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => ejecutar("acreditar")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
        >
          <CheckCircle2 size={13} /> Acreditar
        </button>
        {esAdmin && !rechazando && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => { setRechazando(true); setMsg(null); setErr(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger/20 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/30 disabled:opacity-50"
          >
            <XCircle size={13} /> Rechazar
          </button>
        )}
        <span className="text-[11px] text-muted-foreground">Las acciones aplican sobre los seleccionados; el sistema omite los que no correspondan.</span>
      </div>
      {rechazando && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-muted/30 p-2">
          <input type="number" min="0" step="0.01" placeholder="Multa al cliente ARS" title="Se aplica a cada cheque del lote" value={multa} onChange={(e) => setMulta(e.target.value)} className={inp} />
          <input type="number" min="0" step="0.01" placeholder="Gasto banco (vacío = por cuenta)" title="Vacío: usa la multa por rechazo configurada en la cuenta de cada cheque" value={gasto} onChange={(e) => setGasto(e.target.value)} className={inp} />
          <input placeholder="Motivo (común al lote)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inp} />
          <button type="button" disabled={pendiente} onClick={() => ejecutar("rechazar")} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger disabled:opacity-50">
            Confirmar rechazo del lote
          </button>
          <button type="button" onClick={() => setRechazando(false)} className="rounded-lg border border-border px-2 py-1.5 text-xs text-foreground/90">×</button>
        </div>
      )}
      {(msg || err) && (
        <p className={"mt-2 text-xs " + (err ? "text-danger" : "text-primary")}>{err ?? msg}</p>
      )}
      {pendiente && <p className="mt-2 text-xs text-muted-foreground">Procesando lote…</p>}
    </div>
  );
}
