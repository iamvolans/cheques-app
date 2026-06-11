import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { descargarArchivoDrive } from "@/lib/google-drive/descargar";

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const solicitudId = req.nextUrl.searchParams.get("solicitud") ?? "";
  if (token.length < 32 || !solicitudId) {
    return NextResponse.json({ error: "Solicitud inválida" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: cliente } = await admin
    .from("clientes").select("id").eq("portal_token", token).single();
  if (!cliente) return NextResponse.json({ error: "Portal inválido" }, { status: 404 });

  const { data: sol } = await admin
    .from("solicitudes_liquidacion")
    .select("id, comprobante_drive_id, comprobante_nombre")
    .eq("id", solicitudId)
    .eq("cliente_id", cliente.id)
    .single();

  if (!sol?.comprobante_drive_id) {
    return NextResponse.json(
      { error: "El comprobante ya no está disponible (se elimina automáticamente a las 48 hs de la transferencia)." },
      { status: 404 }
    );
  }

  let archivo;
  try {
    archivo = await descargarArchivoDrive(sol.comprobante_drive_id);
  } catch {
    // El archivo ya no existe en Drive: limpiamos la referencia para que no muestre el botón
    await admin
      .from("solicitudes_liquidacion")
      .update({ comprobante_drive_id: null, comprobante_nombre: null, comprobante_subido_at: null })
      .eq("id", sol.id);
    return NextResponse.json({ error: "El comprobante ya no está disponible." }, { status: 404 });
  }

  // Re-descargable: NO se borra acá. La limpieza la hace el cron a las 48 hs.
  const nombre = sol.comprobante_nombre ?? "comprobante.pdf";
  return new NextResponse(new Uint8Array(archivo.buffer), {
    headers: {
      "Content-Type": archivo.mime,
      "Content-Disposition": `attachment; filename="${nombre.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
