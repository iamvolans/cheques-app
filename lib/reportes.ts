import type { SupabaseClient } from "@supabase/supabase-js";

export type FilaReporte = {
  numero_cheque: string;
  librador: string;
  monto: number;
  fee: number;
  estado: string;
  fecha: string;
  convenio: string;
  cliente: string;
};

export type GrupoConvenio = {
  convenio: string;
  cantidad: number;
  montoGestionado: number;
  neto: number;
  iva: number;
  total: number;
};

export const IVA_PCT = 0.21;

// Resuelve el periodo: acepta desde/hasta libres, o "mes" (links viejos), o default mes actual.
export function rangoPeriodo(p: { mes?: string; desde?: string; hasta?: string }): { desde: string; hasta: string } {
  if (p.desde && p.hasta) return { desde: p.desde, hasta: p.hasta };
  const mes = p.mes ?? new Date().toISOString().slice(0, 7);
  const [y, m] = mes.split("-").map(Number);
  return {
    desde: mes + "-01",
    hasta: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}

// Cheques resueltos (procesados/rechazados) del periodo [desde, hasta] inclusive,
// cortados por fecha_resolucion (cuando se devengo la comision), agrupados por convenio.
export async function obtenerReporte(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
  convenioId?: string
): Promise<{ filas: FilaReporte[]; grupos: GrupoConvenio[] }> {
  const [y, m, d] = hasta.split("-").map(Number);
  const finExclusivo = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10);

  let q = supabase
    .from("cheques")
    .select(
      "numero_cheque, librador, monto, fee_calculado, estado, fecha_resolucion, convenio_id, convenios(razon_social), clientes(razon_social)"
    )
    .in("estado", ["procesado", "rechazado"])
    .gte("fecha_resolucion", desde)
    .lt("fecha_resolucion", finExclusivo)
    .order("fecha_resolucion");
  if (convenioId) q = q.eq("convenio_id", convenioId);

  const { data } = await q;
  const rel = (x: unknown) => (x as { razon_social?: string } | null)?.razon_social ?? "—";

  const filas: FilaReporte[] = (data ?? []).map((c) => ({
    numero_cheque: c.numero_cheque,
    librador: c.librador,
    monto: Number(c.monto),
    fee: Number(c.fee_calculado),
    estado: c.estado,
    fecha: String(c.fecha_resolucion ?? "").slice(0, 10),
    convenio: rel(c.convenios),
    cliente: rel(c.clientes),
  }));

  const mapa = new Map<string, GrupoConvenio>();
  for (const fi of filas) {
    const g = mapa.get(fi.convenio) ?? {
      convenio: fi.convenio, cantidad: 0, montoGestionado: 0, neto: 0, iva: 0, total: 0,
    };
    g.cantidad++;
    g.montoGestionado += fi.monto;
    g.neto += fi.fee;
    mapa.set(fi.convenio, g);
  }
  const grupos = [...mapa.values()]
    .map((g) => ({ ...g, iva: g.neto * IVA_PCT, total: g.neto * (1 + IVA_PCT) }))
    .sort((a, b) => b.neto - a.neto);

  return { filas, grupos };
}
