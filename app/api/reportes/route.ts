import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerReporte } from "@/lib/reportes";

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: perfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return new NextResponse("Forbidden", { status: 403 });

  const url = new URL(req.url);
  const mes = url.searchParams.get("mes") ?? new Date().toISOString().slice(0, 7);
  const convenio = url.searchParams.get("convenio") ?? undefined;

  const { filas, grupos } = await obtenerReporte(supabase, mes, convenio || undefined);
  const n = (x: number) => x.toFixed(2).replace(".", ",");

  const lineas: string[] = [];
  lineas.push(`Reporte de facturación por convenio;Mes: ${mes}`);
  lineas.push("");
  lineas.push("Convenio;Cheques;Monto gestionado;Fee neto;IVA 21%;Total a facturar");
  for (const g of grupos) {
    lineas.push(`${g.convenio};${g.cantidad};${n(g.montoGestionado)};${n(g.neto)};${n(g.iva)};${n(g.total)}`);
  }
  lineas.push("");
  lineas.push("Fecha;Convenio;Cliente;N° cheque;Librador;Monto;Fee;Estado");
  for (const fi of filas) {
    lineas.push(`${fi.fecha};${fi.convenio};${fi.cliente};${fi.numero_cheque};${fi.librador};${n(fi.monto)};${n(fi.fee)};${fi.estado}`);
  }

  return new NextResponse("\uFEFF" + lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="reporte-convenios-${mes}.csv"`,
    },
  });
}
