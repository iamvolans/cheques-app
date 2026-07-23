import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const COLS = "numero_cheque, tipo, librador, cuit_librador, clientes(razon_social), plaza, codigo_postal, monto, fee_aplicado_pct, fee_calculado, estado, banco_emisor, fecha_cobro, fecha_estimada_acred, gasto_bancario, multa, motivo_rechazo, created_at";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const p = req.nextUrl.searchParams;
  const desde = p.get("desde");
  const hasta = p.get("hasta");
  const cliente = p.get("cliente");
  const estado = p.get("estado");
  const montoDesde = p.get("montoDesde");
  const montoHasta = p.get("montoHasta");
  const tipo = p.get("tipo");
  const plaza = p.get("plaza");
  const qTexto = (p.get("q") ?? "").trim().replace(/[,()%]/g, "");

  // Paginado interno: bloques de 1000 (límite de Supabase) hasta agotar — sin tope total
  type Fila = Record<string, unknown>;
  const todas: Fila[] = [];
  const BLOQUE = 1000;
  for (let inicio = 0; ; inicio += BLOQUE) {
    let q = supabase
      .from("cheques")
      .select(COLS)
      .order("fecha_cobro", { ascending: false })
      .range(inicio, inicio + BLOQUE - 1);
    if (desde) q = q.gte("fecha_cobro", desde);
    if (hasta) q = q.lte("fecha_cobro", hasta);
    if (cliente) q = q.eq("cliente_id", cliente);
    if (estado) q = q.eq("estado", estado);
    if (montoDesde && !isNaN(Number(montoDesde))) q = q.gte("monto", Number(montoDesde));
    if (montoHasta && !isNaN(Number(montoHasta))) q = q.lte("monto", Number(montoHasta));
    if (tipo === "echeq" || tipo === "fisico") q = q.eq("tipo", tipo);
    if (plaza === "camara" || plaza === "interior") q = q.eq("plaza", plaza);
    if (qTexto) {
      q = q.or(`numero_cheque.ilike.%${qTexto}%,librador.ilike.%${qTexto}%,cuit_librador.ilike.%${qTexto}%,banco_emisor.ilike.%${qTexto}%`);
    }
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    todas.push(...(data ?? []));
    if (!data || data.length < BLOQUE) break; // último bloque
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
    "Estado": c.estado,
    "Banco emisor": c.banco_emisor,
    "Fecha cobro": c.fecha_cobro,
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
  const rango = `${desde ?? "inicio"}_a_${hasta ?? "hoy"}`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="cheques_${rango}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
