import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function AcreditacionesVencidas() {
  const supabase = await createClient();
  const hoy = new Date().toISOString().slice(0, 10);

  const { data } = await supabase
    .from("cheques")
    .select("id, monto, fecha_estimada_acred")
    .eq("estado", "depositado")
    .lt("fecha_estimada_acred", hoy);

  const vencidas = data ?? [];
  if (vencidas.length === 0) return null;

  const total = vencidas.reduce((a, c) => a + Number(c.monto), 0);
  const fmt = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

  return (
    <Link
      href="/cheques?estado=depositado"
      className="block rounded-2xl border border-warning/40/60 bg-warning-muted/30 px-4 py-3 text-sm text-warning transition hover:bg-warning-muted/50"
    >
      ⚠ {vencidas.length} cheque{vencidas.length === 1 ? "" : "s"} depositado{vencidas.length === 1 ? "" : "s"} {vencidas.length === 1 ? "ya pasó" : "ya pasaron"} su fecha estimada de acreditación ({fmt.format(total)}). Revisá si ya acreditaron o si hubo un rechazo.
    </Link>
  );
}
