"use client";

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

const estiloTooltip = {
  contentStyle: {
    background: "#18181b",
    border: "1px solid #3f3f46",
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: "#a1a1aa" },
};

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20">
      <p className="mb-3 text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
      <div className="h-52">{children}</div>
    </div>
  );
}

export default function Graficos({ datos }: { datos: PuntoMes[] }) {
  if (datos.length === 0) return null;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <Tarjeta titulo="Volumen procesado por mes">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="#71717a" fontSize={11} />
            <YAxis tickFormatter={(v) => compacto.format(v)} stroke="#71717a" fontSize={11} width={48} />
            <Tooltip {...estiloTooltip} formatter={(v) => [ars.format(Number(v)), "Volumen"]} labelFormatter={mesCorto} />
            <Bar dataKey="volumen" fill="#10b981" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Tarjeta>

      <Tarjeta titulo="Ganancia (fees) por mes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="#71717a" fontSize={11} />
            <YAxis tickFormatter={(v) => compacto.format(v)} stroke="#71717a" fontSize={11} width={48} />
            <Tooltip {...estiloTooltip} formatter={(v) => [ars.format(Number(v)), "Ganancia"]} labelFormatter={mesCorto} />
            <Line type="monotone" dataKey="ganancia" stroke="#8b5cf6" strokeWidth={2.5} dot={{ r: 4, fill: "#8b5cf6" }} />
          </LineChart>
        </ResponsiveContainer>
      </Tarjeta>

      <Tarjeta titulo="% de rechazo por mes">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={datos}>
            <CartesianGrid stroke="#27272a" vertical={false} />
            <XAxis dataKey="mes" tickFormatter={mesCorto} stroke="#71717a" fontSize={11} />
            <YAxis tickFormatter={(v) => `${v}%`} stroke="#71717a" fontSize={11} width={40} />
            <Tooltip {...estiloTooltip} formatter={(v) => [`${v}%`, "Rechazo"]} labelFormatter={mesCorto} />
            <Line type="monotone" dataKey="pctRechazo" stroke="#f87171" strokeWidth={2.5} dot={{ r: 4, fill: "#f87171" }} />
          </LineChart>
        </ResponsiveContainer>
      </Tarjeta>
    </div>
  );
}
