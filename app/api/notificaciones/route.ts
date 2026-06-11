import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { enviarRechazo } from "@/lib/email/rechazo";
import { enviarTransferenciaRealizada } from "@/lib/email/transferencia";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const supabase = createAdminClient();

  const { data: pendientes, error } = await supabase
    .from("notificaciones_pendientes")
    .select("*, clientes(razon_social, email)")
    .eq("enviada", false)
    .limit(20);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  let enviadas = 0;
  const errores: string[] = [];

  for (const n of pendientes ?? []) {
    try {
      if (n.tipo === "cheque_rechazado" && n.clientes?.email) {
        await enviarRechazo(n.clientes.email, n.clientes.razon_social, n.payload);
      } else if (n.tipo === "transferencia_realizada" && n.clientes?.email) {
        await enviarTransferenciaRealizada(n.clientes.email, n.clientes.razon_social, n.payload);
      }
      await supabase
        .from("notificaciones_pendientes")
        .update({ enviada: true, enviada_at: new Date().toISOString() })
        .eq("id", n.id);
      enviadas++;
    } catch (e) {
      errores.push(`${n.id}: ${(e as Error).message}`);
    }
  }

  return NextResponse.json({ pendientes: pendientes?.length ?? 0, enviadas, errores });
}
