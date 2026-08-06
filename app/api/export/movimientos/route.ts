import { fechaHoraART } from "@/lib/fechas";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

const ETIQUETA_TIPO: Record<string, string> = {
  acreditacion: "Acreditación",
  debito_rechazo: "Débito por rechazo",
  liquidacion: "Liquidación",
  ajuste_manual: "Ajuste manual",
};

type ChequeInfo = {
  numero_cheque: string | null;
  librador: string | null;
  monto: number | null;
  fee_calculado: number | null;
  multa: number | null;
} | null;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const clienteId = req.nextUrl.searchParams.get("cliente");
  if (!clienteId) return NextResponse.json({ error: "Falta el cliente" }, { status: 400 });
  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  const { data: cli } = await supabase.from("clientes").select("razon_social").eq("id", clienteId).single();

  // Sin tope de 1000: paginado interno hasta agotar (el saldo acumulado necesita TODOS los movimientos)
  type MovRaw = {
    created_at: string; tipo: string; descripcion: string | null; monto: number | string;
    cheques: unknown;
  };
  const movs: MovRaw[] = [];
  for (let i = 0; ; i += 1000) {
    const { data } = await supabase
      .from("movimientos_clientes")
      .select("created_at, tipo, descripcion, monto, cheques(numero_cheque, librador, monto, fee_calculado, multa)")
      .eq("cliente_id", clienteId)
      .order("created_at", { ascending: true })
      .range(i, i + 999);
    movs.push(...((data ?? []) as unknown as MovRaw[]));
    if (!data || data.length < 1000) break;
  }

  // Saldo acumulado sobre TODO el historial; luego se filtra por rango
  let saldo = 0;
  const todas = movs.map((m) => {
    saldo += Number(m.monto);
    return {
      created_at: m.created_at,
      tipo: m.tipo,
      descripcion: m.descripcion ?? "",
      monto: Number(m.monto),
      saldo,
      cheque: (m.cheques as unknown as ChequeInfo) ?? null,
    };
  });

  const filas = todas
    .filter((m) => {
      const f = m.created_at.slice(0, 10);
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    })
    .map((m) => {
      const esCredito = m.monto >= 0;
      const ch = m.cheque;
      const fee = ch?.fee_calculado != null ? Number(ch.fee_calculado) : null;
      const multa = m.tipo === "debito_rechazo" && ch?.multa != null ? Number(ch.multa) : null;
      return {
        "Fecha": fechaHoraART(m.created_at),
        "Tipo": ETIQUETA_TIPO[m.tipo] ?? m.tipo,
        "N° Cheque": ch?.numero_cheque ?? "",
        "Librador": ch?.librador ?? "",
        "Monto cheque": ch?.monto != null ? Number(ch.monto) : "",
        "Fee": ch && fee != null ? fee : "",
        "Multa": multa ?? "",
        "Crédito": esCredito ? m.monto : "",
        "Débito": !esCredito ? m.monto : "",
        "Saldo acumulado": Number(m.saldo.toFixed(2)),
        "Descripción": m.descripcion,
      };
    });

  const ws = XLSX.utils.json_to_sheet(filas);
  ws["!cols"] = [
    { wch: 18 }, { wch: 18 }, { wch: 12 }, { wch: 26 }, { wch: 14 },
    { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 15 }, { wch: 50 },
  ];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Extracto");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const nombre = (cli?.razon_social ?? "cliente").replace(/[^\w]/g, "_");
  const rango = `${desde ?? "inicio"}_a_${hasta ?? "hoy"}`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="extracto_${nombre}_${rango}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
