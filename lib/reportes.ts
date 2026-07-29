import type { SupabaseClient } from "@supabase/supabase-js";
import { mesART } from "@/lib/fechas";

export type FilaReporte = {
  numero_cheque: string;
  librador: string;
  monto: number;
  feeBruto: number;
  costo: number;
  multaBanco: number;
  neto: number;
  estado: string;
  fecha: string;
  convenio: string;
  cliente: string;
};

export type GrupoConvenio = {
  convenio: string;
  cantidad: number;
  montoGestionado: number;
  feeBruto: number;
  costo: number;
  multaBanco: number;
  neto: number;
  iva: number;
  total: number;
};

export const IVA_PCT = 0.21;

// Resuelve el periodo: acepta desde/hasta libres, o "mes" (links viejos), o default mes actual.
export function rangoPeriodo(p: { mes?: string; desde?: string; hasta?: string }): { desde: string; hasta: string } {
  if (p.desde && p.hasta) return { desde: p.desde, hasta: p.hasta };
  const mes = p.mes ?? mesART();
  const [y, m] = mes.split("-").map(Number);
  return {
    desde: mes + "-01",
    hasta: new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10),
  };
}

// Lee de vw_facturacion_cheques, que ya trae el neto calculado por cheque.
// Pagina de a 1000 (limite de Supabase): sin esto los periodos grandes se truncaban
// en silencio y se facturaba de menos.
export async function obtenerReporte(
  supabase: SupabaseClient,
  desde: string,
  hasta: string,
  convenioId?: string
): Promise<{ filas: FilaReporte[]; grupos: GrupoConvenio[] }> {
  type Cruda = Record<string, unknown>;
  const todas: Cruda[] = [];
  const BLOQUE = 1000;

  for (let inicio = 0; ; inicio += BLOQUE) {
    let q = supabase
      .from("vw_facturacion_cheques")
      .select("*")
      .gte("fecha_facturacion", desde)
      .lte("fecha_facturacion", hasta)
      .order("fecha_facturacion")
      .range(inicio, inicio + BLOQUE - 1);
    if (convenioId) q = q.eq("convenio_id", convenioId);

    const { data, error } = await q;
    if (error) break;
    todas.push(...(data ?? []));
    if (!data || data.length < BLOQUE) break;
  }

  const filas: FilaReporte[] = todas.map((c) => ({
    numero_cheque: String(c.numero_cheque ?? ""),
    librador: String(c.librador ?? ""),
    monto: Number(c.monto ?? 0),
    feeBruto: Number(c.fee_bruto ?? 0),
    costo: Number(c.costo_procesamiento ?? 0),
    multaBanco: Number(c.multa_banco ?? 0),
    neto: Number(c.neto ?? 0),
    estado: String(c.estado ?? ""),
    fecha: String(c.fecha_facturacion ?? "").slice(0, 10),
    convenio: String(c.convenio ?? "—"),
    cliente: String(c.cliente ?? "—"),
  }));

  const mapa = new Map<string, GrupoConvenio>();
  for (const fi of filas) {
    const g = mapa.get(fi.convenio) ?? {
      convenio: fi.convenio, cantidad: 0, montoGestionado: 0,
      feeBruto: 0, costo: 0, multaBanco: 0, neto: 0, iva: 0, total: 0,
    };
    g.cantidad++;
    g.montoGestionado += fi.monto;
    g.feeBruto += fi.feeBruto;
    g.costo += fi.costo;
    g.multaBanco += fi.multaBanco;
    g.neto += fi.neto;
    mapa.set(fi.convenio, g);
  }

  const grupos = [...mapa.values()]
    .map((g) => ({ ...g, iva: g.neto * IVA_PCT, total: g.neto * (1 + IVA_PCT) }))
    .sort((a, b) => b.neto - a.neto);

  return { filas, grupos };
}
