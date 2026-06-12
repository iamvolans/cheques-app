import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { carpetaBackupMensual, subirArchivo } from "@/lib/google-drive/drive";

export const maxDuration = 60;

function aCsv(filas: Record<string, unknown>[]): string {
  if (!filas.length) return "(sin registros)";
  const cols = Object.keys(filas[0]);
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [cols.join(","), ...filas.map((f) => cols.map((c) => esc(f[c])).join(","))].join("\n");
}

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const [{ data: cheques }, { data: movimientos }, { data: liquidaciones }] = await Promise.all([
    supabase.from("cheques").select("*").order("created_at", { ascending: true }),
    supabase.from("movimientos_clientes").select("*").order("created_at", { ascending: true }),
    supabase.from("liquidaciones").select("*").order("created_at", { ascending: true }),
  ]);

  const carpeta = await carpetaBackupMensual();
  const sello = new Date().toISOString().slice(0, 10);

  const archivos = [
    { nombre: `cheques_${sello}.csv`, filas: (cheques ?? []) as Record<string, unknown>[] },
    { nombre: `movimientos_${sello}.csv`, filas: (movimientos ?? []) as Record<string, unknown>[] },
    { nombre: `liquidaciones_${sello}.csv`, filas: (liquidaciones ?? []) as Record<string, unknown>[] },
  ];

  const subidos: string[] = [];
  for (const a of archivos) {
    const csv = aCsv(a.filas);
    await subirArchivo(Buffer.from(csv, "utf8"), a.nombre, "text/csv", carpeta);
    subidos.push(`${a.nombre} (${a.filas.length} filas)`);
  }

  return NextResponse.json({ ok: true, carpeta, archivos: subidos });
}
