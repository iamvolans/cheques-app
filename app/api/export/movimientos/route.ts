import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const clienteId = req.nextUrl.searchParams.get("cliente");
  if (!clienteId) return NextResponse.json({ error: "Falta el cliente" }, { status: 400 });
  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  const { data: cli } = await supabase.from("clientes").select("razon_social").eq("id", clienteId).single();
  const { data: movs } = await supabase
    .from("movimientos_clientes")
    .select("created_at, tipo, descripcion, monto")
    .eq("cliente_id", clienteId)
    .order("created_at", { ascending: true });

  // Saldo acumulado calculado sobre TODO el historial; luego se filtra por rango
  let saldo = 0;
  const todas = (movs ?? []).map((m) => {
    saldo += Number(m.monto);
    return { created_at: m.created_at as string, tipo: m.tipo, descripcion: m.descripcion, monto: Number(m.monto), saldo };
  });

  const filas = todas
    .filter((m) => {
      const f = m.created_at.slice(0, 10);
      if (desde && f < desde) return false;
      if (hasta && f > hasta) return false;
      return true;
    })
    .map((m) => ({
      "Fecha": new Date(m.created_at).toLocaleString("es-AR"),
      "Tipo": m.tipo,
      "Descripción": m.descripcion ?? "",
      "Monto": m.monto,
      "Saldo acumulado": Number(m.saldo.toFixed(2)),
    }));

  const ws = XLSX.utils.json_to_sheet(filas);
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
