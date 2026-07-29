import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { obtenerReporte, rangoPeriodo } from "@/lib/reportes";

export const maxDuration = 60;

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
  const { desde, hasta } = rangoPeriodo({
    mes: url.searchParams.get("mes") ?? undefined,
    desde: url.searchParams.get("desde") ?? undefined,
    hasta: url.searchParams.get("hasta") ?? undefined,
  });
  const convenio = url.searchParams.get("convenio") ?? undefined;

  const { filas, grupos } = await obtenerReporte(supabase, desde, hasta, convenio || undefined);
  const n = (x: number) => x.toFixed(2).replace(".", ",");

  const lineas: string[] = [];
  lineas.push("Reporte de facturación por convenio;Período: " + desde + " a " + hasta);
  lineas.push("Neto = fee - costo de procesamiento - multa del banco (rechazados). La multa al cliente no se factura.");
  lineas.push("");
  lineas.push("Convenio;Cheques;Monto gestionado;Fee bruto;Costo procesamiento;Multa banco;Neto a facturar;IVA 21%;Total");
  for (const g of grupos) {
    lineas.push(
      g.convenio + ";" + g.cantidad + ";" + n(g.montoGestionado) + ";" + n(g.feeBruto) + ";" +
      n(g.costo) + ";" + n(g.multaBanco) + ";" + n(g.neto) + ";" + n(g.iva) + ";" + n(g.total)
    );
  }
  lineas.push("");
  lineas.push("Fecha;Convenio;Cliente;N° cheque;Librador;Monto;Fee bruto;Costo proc.;Multa banco;Neto;Estado");
  for (const fi of filas) {
    lineas.push(
      fi.fecha + ";" + fi.convenio + ";" + fi.cliente + ";" + fi.numero_cheque + ";" + fi.librador + ";" +
      n(fi.monto) + ";" + n(fi.feeBruto) + ";" + n(fi.costo) + ";" + n(fi.multaBanco) + ";" + n(fi.neto) + ";" + fi.estado
    );
  }

  return new NextResponse("\uFEFF" + lineas.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="reporte-convenios-' + desde + "_a_" + hasta + '.csv"',
    },
  });
}
