"use client";
import { useEffect, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

export type PuntoMes = {
  mes: string;
  ganancia: number;
  volumen: number;
  rechazos: number;
  total: number;
  pctRechazo: number;
};

const compacto = new Intl.NumberFormat("es-AR", { notation: "compact" });
const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const mesCorto = (m: unknown) => {
  const s = String(m ?? "");
  return `${s.slice(5, 7)}/${s.slice(2, 4)}`;
};

// Lee las CSS vars del tema vigente y reacciona al toggle claro/oscuro
function useTema() {
  const [t, setT] = useState({
    grid: "#27272a", axis: "#71717a", card: "#18181b",
    border: "#3f3f46", muted: "#a1a1aa", primary: "#10b981",
    info: "#8b5cf6", danger: "#f87171",
  });
  useEffect(() => {
    const leer = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
      setT({
        grid: v("--border", "#27272a"),
        axis: v("--muted-foreground", "#71717a"),
        card: v("--popover", "#18181b"),
        border: v("--border", "#3f3f46"),
        muted: v("--muted-foreground", "#a1a1aa"),
        primary: v("--primary", "#10b981"),
        info: v("--info", "#8b5cf6"),
        danger: v("--danger", "#f87171"),
      });
    };
    leer();
    // Re-leer cuando cambia la clase .dark en <html>
    const obs = new MutationObserver(leer);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5">
      <p className="mb-3 text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
      <div className="h-52">{children}</div>
    </div>
  );
}

export default function Graficos({ datos }: { datos: PuntoMes[] }) {
  const c = useTema();
  if (datos.length === 0) return null;

  const tooltip = {
    contentStyle: { background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12, color: c.muted },
    labelStyle: { color: c.muted },
    itemStyle: { color: c.muted },
  };

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Tarjeta titulo="Volumen procesado por mes">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} stroke={c.axis} fontSize={11} />
            <YAxis tickFormatter={(v) => compacto.format(v)} stroke={c.axis} fontSize={11} width={48} />
            <Tooltip {...tooltip} formatter={(v) => [ars.format(Number(v)), "Volumen"]} labelFormatter={mesCorto} cursor={{ fill: c.grid, opacity: 0.3 }} />
            <Bar dataKey="volumen" fill={c.primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Tarjeta>
      <Tarjeta titulo="Ganancia (fees) por mes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} stroke={c.axis} fontSize={11} />
            <YAxis tickFormatter={(v) => compacto.format(v)} stroke={c.axis} fontSize={11} width={48} />
            <Tooltip {...tooltip} formatter={(v) => [ars.format(Number(v)), "Ganancia"]} labelFormatter={mesCorto} />
            <Line type="monotone" dataKey="ganancia" stroke={c.info} strokeWidth={2.5} dot={{ r: 4, fill: c.info }} />
          </LineChart>
        </ResponsiveContainer>
      </Tarjeta>
      <Tarjeta titulo="% de rechazo por mes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} stroke={c.axis} fontSize={11} />
            <YAxis tickFormatter={(v) => `${v}%`} stroke={c.axis} fontSize={11} width={40} />
            <Tooltip {...tooltip} formatter={(v) => [`${v}%`, "Rechazo"]} labelFormatter={mesCorto} />
            <Line type="monotone" dataKey="pctRechazo" stroke={c.danger} strokeWidth={2.5} dot={{ r: 4, fill: c.danger }} />
          </LineChart>
        </ResponsiveContainer>
      </Tarjeta>
    </div>
  );
}
