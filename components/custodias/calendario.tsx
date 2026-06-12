"use client";

import { useState } from "react";

type Item = {
  id: string;
  numero_cheque: string;
  librador: string;
  monto: number;
  fecha_cobro: string;
  cliente: string;
};

const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const MESES = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];

export default function Calendario({ items }: { items: Item[] }) {
  const hoy = new Date();
  const [year, setYear] = useState(hoy.getFullYear());
  const [month, setMonth] = useState(hoy.getMonth());
  const [sel, setSel] = useState<string | null>(null);

  const porFecha = new Map<string, Item[]>();
  for (const it of items) {
    const arr = porFecha.get(it.fecha_cobro) ?? [];
    arr.push(it);
    porFecha.set(it.fecha_cobro, arr);
  }

  const primero = new Date(year, month, 1);
  const offset = (primero.getDay() + 6) % 7; // Lunes primero
  const diasEnMes = new Date(year, month + 1, 0).getDate();

  const celdas: (number | null)[] = [];
  for (let i = 0; i < offset; i++) celdas.push(null);
  for (let d = 1; d <= diasEnMes; d++) celdas.push(d);

  const clave = (d: number) => `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
  function cambiar(delta: number) {
    let m = month + delta, y = year;
    if (m < 0) { m = 11; y--; }
    if (m > 11) { m = 0; y++; }
    setMonth(m); setYear(y); setSel(null);
  }

  const hoyClave = `${hoy.getFullYear()}-${String(hoy.getMonth() + 1).padStart(2, "0")}-${String(hoy.getDate()).padStart(2, "0")}`;
  const seleccionados = sel ? (porFecha.get(sel) ?? []) : [];
  const btn = "rounded-lg border border-zinc-700 px-3 py-1 text-sm text-zinc-300 transition hover:bg-zinc-800";

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button onClick={() => cambiar(-1)} className={btn}>←</button>
        <p className="text-sm font-medium text-zinc-200">{MESES[month]} {year}</p>
        <button onClick={() => cambiar(1)} className={btn}>→</button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] uppercase text-zinc-500">
        {DIAS.map((d) => <div key={d} className="py-1">{d}</div>)}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {celdas.map((d, i) => {
          if (d === null) return <div key={i} />;
          const k = clave(d);
          const lista = porFecha.get(k) ?? [];
          const total = lista.reduce((a, x) => a + Number(x.monto), 0);
          const esHoy = k === hoyClave;
          return (
            <button
              key={i}
              onClick={() => setSel(lista.length ? k : null)}
              className={`min-h-16 rounded-lg border p-1 text-left transition ${lista.length ? "border-amber-700/50 bg-amber-950/20 hover:bg-amber-950/40" : "border-zinc-800 bg-zinc-900/40"} ${esHoy ? "ring-1 ring-emerald-500" : ""}`}
            >
              <span className={`text-xs ${esHoy ? "font-bold text-emerald-400" : "text-zinc-400"}`}>{d}</span>
              {lista.length > 0 && (
                <span className="mt-1 block text-[10px] leading-tight text-amber-300">{lista.length} val. · {fmt.format(total)}</span>
              )}
            </button>
          );
        })}
      </div>

      {sel && (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-400">Liberan el {sel}</p>
          <div className="divide-y divide-zinc-800/70">
            {seleccionados.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                <span className="truncate text-zinc-200">
                  <span className="font-mono text-zinc-400">N° {x.numero_cheque}</span> · {x.librador} <span className="text-zinc-500">({x.cliente})</span>
                </span>
                <span className="shrink-0 font-mono text-zinc-100">{fmt.format(Number(x.monto))}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
