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

  let q = supabase.from("logs_auditoria").select("*").order("created_at", { ascending: false }).limit(20000);
  if (desde) q = q.gte("created_at", desde);
  if (hasta) q = q.lte("created_at", `${hasta}T23:59:59`);
  if (tabla && tabla !== "todas") q = q.eq("tabla", tabla);

  const { data, error } = await q;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const filas = (data ?? []).map((l) => ({
    "Cuándo": new Date(l.created_at).toLocaleString("es-AR"),
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
