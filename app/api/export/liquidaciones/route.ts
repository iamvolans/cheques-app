import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");

  let q = supabase
    .from("liquidaciones")
    .select("fecha_transferencia, clientes(razon_social), coelsa_id, beneficiario, cuit_beneficiario, cvu_cbu_destino, alias_destino, monto_liquidado, created_at")
    .order("fecha_transferencia", { ascending: false })
    .limit(10000);
  if (desde) q = q.gte("fecha_transferencia", desde);
  if (hasta) q = q.lte("fecha_transferencia", hasta);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (data ?? []).map((l) => ({
    "Fecha transferencia": l.fecha_transferencia,
    "Cliente": (l.clientes as unknown as { razon_social?: string } | null)?.razon_social ?? "",
    "Coelsa ID": l.coelsa_id,
    "Beneficiario": l.beneficiario,
    "CUIT Beneficiario": l.cuit_beneficiario ?? "",
    "CBU/CVU": l.cvu_cbu_destino ?? "",
    "Alias": l.alias_destino ?? "",
    "Monto": Number(l.monto_liquidado),
    "Creado": l.created_at,
  }));

  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Liquidaciones");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const rango = `${desde ?? "inicio"}_a_${hasta ?? "hoy"}`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="liquidaciones_${rango}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
