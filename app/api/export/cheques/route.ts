import { etiquetaEstado } from "@/lib/estados";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { aplicarFiltros, type FiltrosCheques } from "@/lib/filtros-cheques";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const COLS = "numero_cheque, tipo, librador, cuit_librador, clientes(razon_social), plaza, codigo_postal, monto, fee_aplicado_pct, fee_calculado, estado, banco_emisor, fecha_cobro, fecha_pago, fecha_deposito, fecha_estimada_acred, gasto_bancario, multa, motivo_rechazo, created_at";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const p = req.nextUrl.searchParams;
  const val = (k: string) => p.get(k) ?? undefined;

  const f: FiltrosCheques = {
    desde: val("desde"),
    hasta: val("hasta"),
    cliente: val("cliente"),
    estado: val("estado"),
    q: val("q"),
    tipoFecha: val("tipoFecha"),
    convenio: val("convenio"),
    montoDesde: val("montoDesde"),
    montoHasta: val("montoHasta"),
    tipo: val("tipo"),
    plaza: val("plaza"),
  };

  // Paginado interno: bloques de 1000 (limite de Supabase) hasta agotar, sin tope total
  type Fila = Record<string, unknown>;
  const todas: Fila[] = [];
  const BLOQUE = 1000;
  for (let inicio = 0; ; inicio += BLOQUE) {
    let q = supabase
      .from("cheques")
      .select(COLS)
      .order("created_at", { ascending: false })
      .range(inicio, inicio + BLOQUE - 1);
    q = aplicarFiltros(q, f);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    todas.push(...(data ?? []));
    if (!data || data.length < BLOQUE) break;
  }

  const filas = todas.map((c) => ({
    "N° Cheque": c.numero_cheque,
    "Tipo": c.tipo,
    "Librador": c.librador,
    "CUIT Librador": c.cuit_librador,
    "Cliente": (c.clientes as unknown as { razon_social?: string } | null)?.razon_social ?? "",
    "Plaza": c.plaza ?? "",
    "CP": c.codigo_postal ?? "",
    "Monto": Number(c.monto),
    "Fee %": Number(c.fee_aplicado_pct ?? 0),
    "Fee calculado": Number(c.fee_calculado ?? 0),
    "Estado": etiquetaEstado(String(c.estado)),
    "Banco emisor": c.banco_emisor,
    "Fecha cobro": c.fecha_cobro,
    "Fecha pago": c.fecha_pago ?? "",
    "Fecha depósito": c.fecha_deposito ?? "",
    "Acred. estimada": c.fecha_estimada_acred ?? "",
    "Gasto bancario": Number(c.gasto_bancario ?? 0),
    "Multa": Number(c.multa ?? 0),
    "Motivo rechazo": c.motivo_rechazo ?? "",
    "Creado": c.created_at,
  }));

  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Cheques");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  const rango = (f.desde ?? "inicio") + "_a_" + (f.hasta ?? "hoy");
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="cheques_' + rango + '.xlsx"',
      "Cache-Control": "no-store",
    },
  });
}
