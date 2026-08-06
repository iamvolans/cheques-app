import { fechaHoraART } from "@/lib/fechas";
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import * as XLSX from "xlsx";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new NextResponse("Unauthorized", { status: 401 });
  const { data: perfil } = await supabase.from("perfiles").select("rol").eq("id", user.id).single();
  if (perfil?.rol !== "administrador") return new NextResponse("Forbidden", { status: 403 });

  const desde = req.nextUrl.searchParams.get("desde");
  const hasta = req.nextUrl.searchParams.get("hasta");
  const tabla = req.nextUrl.searchParams.get("tabla");
  const accion = req.nextUrl.searchParams.get("accion");
  const qTexto = (req.nextUrl.searchParams.get("q") ?? "").trim().replace(/[,()%]/g, "");

  // Sin tope: paginado interno en bloques de 1000 hasta agotar
  type Fila = Record<string, unknown>;
  const todas: Fila[] = [];
  for (let i = 0; ; i += 1000) {
    let q = supabase.from("logs_auditoria").select("*").order("created_at", { ascending: false }).range(i, i + 999);
    if (desde) q = q.gte("created_at", desde);
    if (hasta) q = q.lte("created_at", `${hasta}T23:59:59`);
    if (tabla && tabla !== "todas") q = q.eq("tabla", tabla);
    if (accion && ["INSERT", "UPDATE", "DELETE"].includes(accion)) q = q.eq("accion", accion);
    if (qTexto) q = q.or(`descripcion.ilike.%${qTexto}%,usuario_email.ilike.%${qTexto}%`);
    const { data, error } = await q;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    todas.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }

  const filas = todas.map((l) => ({
    "Cuándo": fechaHoraART(l.created_at as string),
    "Usuario": l.usuario_email ?? "sistema",
    "Acción": l.accion,
    "Tabla": l.tabla,
    "Registro": l.registro_id ?? "",
    "Descripción": l.descripcion ?? "",
    "Antes": l.valores_antes ? JSON.stringify(l.valores_antes) : "",
    "Después": l.valores_despues ? JSON.stringify(l.valores_despues) : "",
  }));

  const ws = XLSX.utils.json_to_sheet(filas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Auditoria");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  const rango = `${desde ?? "inicio"}_a_${hasta ?? "hoy"}`;
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="auditoria_${rango}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}
