import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { borrarArchivoDrive } from "@/lib/google-drive/descargar";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secreto =
    req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-cron-secret") ?? "";
  if (secreto !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const limite = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
  const admin = createAdminClient();
  const { data: vencidos } = await admin
    .from("solicitudes_liquidacion")
    .select("id, comprobante_drive_id")
    .not("comprobante_drive_id", "is", null)
    .lt("comprobante_subido_at", limite);

  let borrados = 0;
  for (const s of vencidos ?? []) {
    try {
      await borrarArchivoDrive(s.comprobante_drive_id as string);
    } catch {
      /* ya no existía en Drive */
    }
    await admin
      .from("solicitudes_liquidacion")
      .update({ comprobante_drive_id: null, comprobante_nombre: null, comprobante_subido_at: null })
      .eq("id", s.id);
    borrados++;
  }

  return NextResponse.json({ ok: true, borrados });
}
