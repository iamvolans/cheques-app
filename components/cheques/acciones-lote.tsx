"use client";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { depositarLote, acreditarLote, rechazarLote, idsFiltrados } from "@/actions/cheques";
import { crearRecibo } from "@/actions/recibos";
import type { FiltrosCheques } from "@/lib/filtros-cheques";
import { Landmark, CheckCircle2, XCircle, ListChecks, Repeat2, Layers, Eraser, ReceiptText } from "lucide-react";

const TROZO = 150;

type Fallido = { numero: string; motivo: string };
type Resultado = { error: string | null; ok?: number; fallidos?: Fallido[] };

export default function AccionesLote({
  esAdmin,
  filtros,
  total,
}: {
  esAdmin: boolean;
  filtros: FiltrosCheques;
  total: number;
}) {
  const [pendiente, startTransition] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [rechazando, setRechazando] = useState(false);
  const [multa, setMulta] = useState("");
  const [gasto, setGasto] = useState("");
  const [motivo, setMotivo] = useState("");
  const [cuenta, setCuenta] = useState(0);
  const [enPagina, setEnPagina] = useState(0);
  const [idsGlobales, setIdsGlobales] = useState<string[] | null>(null);
  const [progreso, setProgreso] = useState<string | null>(null);
  const [confirmar, setConfirmar] = useState<"depositar" | "acreditar" | null>(null);
  const router = useRouter();

  const casillas = () => Array.from(document.querySelectorAll<HTMLInputElement>('input[name="sel"]'));
  const idsMarcados = () => casillas().filter((c) => c.checked).map((c) => c.value);

  const refrescar = () => {
    const cs = casillas();
    setEnPagina(cs.length);
    setCuenta(cs.filter((c) => c.checked).length);
  };

  useEffect(() => {
    const alCambiar = (e: Event) => {
      const t = e.target as HTMLInputElement | null;
      if (t && t.name === "sel") {
        setIdsGlobales(null);
        setConfirmar(null);
        refrescar();
      }
    };
    document.addEventListener("change", alCambiar);
    refrescar();
    return () => document.removeEventListener("change", alCambiar);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const marcar = (v: boolean | "invertir") => {
    casillas().forEach((c) => { c.checked = v === "invertir" ? !c.checked : v; });
    setIdsGlobales(null);
    setConfirmar(null);
    refrescar();
  };

  const seleccionarTodoElFiltro = () => {
    setMsg(null); setErr(null);
    startTransition(async () => {
      const r = await idsFiltrados(filtros);
      if (r.error) { setErr(r.error); return; }
      casillas().forEach((c) => { c.checked = true; });
      refrescar();
      setIdsGlobales(r.ids ?? []);
    });
  };

  const cerrar = (ok: number, fallidos: Fallido[], verbo: string) => {
    const partes = [String(ok) + " " + verbo];
    if (fallidos.length > 0) {
      const muestra = fallidos.slice(0, 8).map((x) => "N° " + x.numero + " (" + x.motivo + ")").join(", ");
      const resto = fallidos.length > 8 ? " y " + (fallidos.length - 8) + " más" : "";
      partes.push(fallidos.length + " omitido" + (fallidos.length === 1 ? "" : "s") + ": " + muestra + resto);
    }
    setMsg(partes.join(" · "));
    setRechazando(false);
    setIdsGlobales(null);
    setConfirmar(null);
    refrescar();
    router.refresh();
  };

  const ejecutar = (accion: "depositar" | "acreditar" | "rechazar") => {
    const ids = idsGlobales ?? idsMarcados();
    setMsg(null); setErr(null);
    if (ids.length === 0) { setErr("No seleccionaste ningún cheque."); return; }
    const verbo =
      accion === "depositar" ? "depositados ✓" : accion === "acreditar" ? "acreditados ✓" : "rechazados ✓";

    startTransition(async () => {
      let ok = 0;
      const fallidos: Fallido[] = [];
      for (let i = 0; i < ids.length; i += TROZO) {
        const trozo = ids.slice(i, i + TROZO);
        if (ids.length > TROZO) {
          setProgreso("Procesando " + Math.min(i + TROZO, ids.length) + " de " + ids.length + "…");
        }
        let r: Resultado;
        if (accion === "depositar") r = await depositarLote(trozo);
        else if (accion === "acreditar") r = await acreditarLote(trozo);
        else r = await rechazarLote({
          ids: trozo,
          multa: Number(multa) || 0,
          gasto: gasto === "" ? null : Number(gasto) || 0,
          motivo,
        });
        if (r.error) {
          setProgreso(null);
          setErr(r.error + (ok > 0 ? " · se alcanzaron a procesar " + ok + " antes del corte" : ""));
          router.refresh();
          return;
        }
        ok += r.ok ?? 0;
        if (r.fallidos) for (const x of r.fallidos) fallidos.push(x);
      }
      setProgreso(null);
      cerrar(ok, fallidos, verbo);
    });
  };

  const generarRecibo = () => {
    const ids = idsGlobales ?? idsMarcados();
    setMsg(null); setErr(null);
    if (ids.length === 0) { setErr("No seleccionaste ningún cheque."); return; }
    startTransition(async () => {
      const r = await crearRecibo(ids);
      if (r.error) { setErr(r.error); return; }
      router.push("/recibos/" + r.reciboId);
    });
  };

  const pedir = (accion: "depositar" | "acreditar") => {
    if (idsGlobales && idsGlobales.length > TROZO) {
      setMsg(null); setErr(null); setConfirmar(accion);
      return;
    }
    ejecutar(accion);
  };

  const sel = idsGlobales ? idsGlobales.length : cuenta;
  const puedeGlobal = !idsGlobales && enPagina > 0 && cuenta === enPagina && total > enPagina;

  const btnSel = "inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-foreground/90 transition hover:bg-muted";
  const inp = "w-40 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary";

  return (
    <div className="mb-3 rounded-2xl border border-border bg-card/50 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={() => marcar(true)} className={btnSel}>
          <ListChecks size={13} /> Seleccionar todos
        </button>
        <button type="button" onClick={() => marcar("invertir")} className={btnSel}>
          <Repeat2 size={13} /> Invertir selección
        </button>
        {sel > 0 && (
          <button type="button" onClick={() => marcar(false)} className={btnSel}>
            <Eraser size={13} /> Limpiar
          </button>
        )}
        <span
          className={
            "rounded-full px-2.5 py-1 text-[11px] font-medium " +
            (sel > 0 ? "bg-primary/15 text-primary" : "text-muted-foreground")
          }
        >
          {sel} de {total} seleccionado{sel === 1 ? "" : "s"}
          {idsGlobales ? " · todo el filtro" : ""}
        </span>
        {puedeGlobal && (
          <button
            type="button"
            disabled={pendiente}
            onClick={seleccionarTodoElFiltro}
            className={btnSel + " border-primary/40 text-primary disabled:opacity-50"}
          >
            <Layers size={13} /> Seleccionar los {total} de todos los filtros
          </button>
        )}
        <span className="mx-1 h-5 w-px bg-border" />
        <button
          type="button"
          disabled={pendiente}
          onClick={() => pedir("depositar")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-700 disabled:opacity-50"
        >
          <Landmark size={13} /> Depositar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={() => pedir("acreditar")}
          className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition hover:bg-primary disabled:opacity-50"
        >
          <CheckCircle2 size={13} /> Acreditar
        </button>
        <button
          type="button"
          disabled={pendiente}
          onClick={generarRecibo}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground/90 transition hover:bg-muted disabled:opacity-50"
        >
          <ReceiptText size={13} /> Generar recibo
        </button>
        {esAdmin && !rechazando && (
          <button
            type="button"
            disabled={pendiente}
            onClick={() => { setRechazando(true); setMsg(null); setErr(null); setConfirmar(null); }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-danger/20 px-3 py-1.5 text-xs font-medium text-danger transition hover:bg-danger/30 disabled:opacity-50"
          >
            <XCircle size={13} /> Rechazar
          </button>
        )}
        <span className="text-[11px] text-muted-foreground">
          Las acciones aplican sobre los seleccionados; el sistema omite los que no correspondan.
        </span>
      </div>

      {confirmar && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-warning/40 bg-warning-muted/30 p-2">
          <span className="text-xs text-foreground">
            Vas a {confirmar} <strong>{sel} cheques</strong> de todos los filtros, en tandas de {TROZO}. ¿Confirmás?
          </span>
          <button
            type="button"
            disabled={pendiente}
            onClick={() => ejecutar(confirmar)}
            className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white transition disabled:opacity-50"
          >
            Sí, {confirmar} los {sel}
          </button>
          <button
            type="button"
            onClick={() => setConfirmar(null)}
            className="rounded-lg border border-border px-2 py-1.5 text-xs text-foreground/90"
          >
            Cancelar
          </button>
        </div>
      )}

      {rechazando && (
        <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-danger/30 bg-danger-muted/30 p-2">
          <input type="number" min="0" step="0.01" placeholder="Multa al cliente ARS" title="Se aplica a cada cheque del lote" value={multa} onChange={(e) => setMulta(e.target.value)} className={inp} />
          <input type="number" min="0" step="0.01" placeholder="Gasto banco (vacío = por cuenta)" title="Vacío: usa la multa por rechazo configurada en la cuenta de cada cheque" value={gasto} onChange={(e) => setGasto(e.target.value)} className={inp} />
          <input placeholder="Motivo (común al lote)" value={motivo} onChange={(e) => setMotivo(e.target.value)} className={inp} />
          <button type="button" disabled={pendiente} onClick={() => ejecutar("rechazar")} className="rounded-lg bg-danger px-3 py-1.5 text-xs font-medium text-white transition hover:bg-danger disabled:opacity-50">
            Confirmar rechazo de {sel} cheque{sel === 1 ? "" : "s"}
          </button>
          <button type="button" onClick={() => setRechazando(false)} className="rounded-lg border border-border px-2 py-1.5 text-xs text-foreground/90">×</button>
        </div>
      )}

      {(msg || err) && (
        <p className={"mt-2 text-xs " + (err ? "text-danger" : "text-primary")}>{err ?? msg}</p>
      )}
      {progreso && <p className="mt-2 text-xs text-muted-foreground">{progreso}</p>}
      {pendiente && !progreso && <p className="mt-2 text-xs text-muted-foreground">Procesando…</p>}
    </div>
  );
}
