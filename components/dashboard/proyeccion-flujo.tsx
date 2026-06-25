"use client";
import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts";

export type DiaProyeccion = { dia: string; cheques: number; monto: number };

const compacto = new Intl.NumberFormat("es-AR", { notation: "compact" });
const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
const diaCorto = (d: unknown) => {
  const s = String(d ?? "");
  return `${s.slice(8, 10)}/${s.slice(5, 7)}`;
};

function useTema() {
  const [t, setT] = useState({ grid: "#27272a", axis: "#71717a", card: "#18181b", border: "#3f3f46", muted: "#a1a1aa", primary: "#10b981" });
  useEffect(() => {
    const leer = () => {
      const cs = getComputedStyle(document.documentElement);
      const v = (n: string, fb: string) => cs.getPropertyValue(n).trim() || fb;
      setT({
        grid: v("--border", "#27272a"), axis: v("--muted-foreground", "#71717a"),
        card: v("--popover", "#18181b"), border: v("--border", "#3f3f46"),
        muted: v("--muted-foreground", "#a1a1aa"), primary: v("--primary", "#10b981"),
      });
    };
    leer();
    const obs = new MutationObserver(leer);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => obs.disconnect();
  }, []);
  return t;
}

export default function ProyeccionFlujo({ datos }: { datos: DiaProyeccion[] }) {
  const c = useTema();
  if (datos.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay acreditaciones proyectadas en los próximos 30 días.</p>;
  }
  const total = datos.reduce((a, d) => a + d.monto, 0);
  const tooltip = {
    contentStyle: { background: c.card, border: `1px solid ${c.border}`, borderRadius: 8, fontSize: 12, color: c.muted },
    labelStyle: { color: c.muted },
    itemStyle: { color: c.muted },
  };
  return (
    <div>
      <p className="mb-3 text-xs text-muted-foreground">
        Total proyectado a 30 días: <span className="metric font-semibold text-primary">{ars.format(total)}</span>
      </p>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid stroke={c.grid} vertical={false} />
            <XAxis dataKey="dia" tickFormatter={diaCorto} stroke={c.axis} fontSize={11} interval="preserveStartEnd" />
            <YAxis tickFormatter={(v) => compacto.format(v)} stroke={c.axis} fontSize={11} width={48} />
            <Tooltip {...tooltip}
              formatter={(v) => [ars.format(Number(v)), "Se acredita"]}
              labelFormatter={(l) => `Día ${diaCorto(l)}`}
              cursor={{ fill: c.grid, opacity: 0.3 }} />
            <Bar dataKey="monto" fill={c.primary} radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
