import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import BotonImprimir from "@/components/ui/boton-imprimir";

export const metadata = { title: "Recibo de devolución" };
const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function ReciboDevolucionPage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const { ids } = await searchParams;
  const lista = (ids ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (lista.length === 0) notFound();

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: cheques } = await supabase
    .from("cheques")
    .select("id, numero_cheque, librador, cuit_librador, banco_emisor, monto, motivo_rechazo, fecha_cobro, clientes(razon_social, cuit)")
    .in("id", lista)
    .eq("estado", "rechazado");
  if (!cheques || cheques.length === 0) notFound();

  const cli = (cheques[0].clientes as unknown as { razon_social?: string; cuit?: string } | null);
  const total = cheques.reduce((a, c) => a + Number(c.monto), 0);
  const hoy = new Date().toLocaleDateString("es-AR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <main className="min-h-screen bg-white p-8 text-black print:p-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide">Recibo de devolución de valores rechazados</h1>
            <p className="mt-1 text-sm">Fecha: {hoy}</p>
          </div>
          <BotonImprimir />
        </div>

        <div className="text-sm">
          <p><span className="font-semibold">Cliente:</span> {cli?.razon_social ?? "—"}</p>
          {cli?.cuit && <p><span className="font-semibold">CUIT:</span> {cli.cuit}</p>}
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-2 pr-3 font-semibold">N° Cheque</th>
              <th className="py-2 pr-3 font-semibold">Librador</th>
              <th className="py-2 pr-3 font-semibold">Banco</th>
              <th className="py-2 pr-3 font-semibold">Motivo rechazo</th>
              <th className="py-2 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody>
            {cheques.map((c) => (
              <tr key={c.id} className="border-b border-neutral-300">
                <td className="py-2 pr-3 font-mono">{c.numero_cheque}</td>
                <td className="py-2 pr-3">{c.librador}<br /><span className="text-xs text-neutral-600">{c.cuit_librador}</span></td>
                <td className="py-2 pr-3">{c.banco_emisor}</td>
                <td className="py-2 pr-3">{c.motivo_rechazo ?? "—"}</td>
                <td className="py-2 text-right font-mono">{ars.format(Number(c.monto))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="py-2 pr-3 text-right font-semibold">Total ({cheques.length} valor{cheques.length === 1 ? "" : "es"})</td>
              <td className="py-2 text-right font-mono font-bold">{ars.format(total)}</td>
            </tr>
          </tbody>
        </table>

        <p className="text-sm leading-relaxed">
          Por el presente, el cliente declara recibir de conformidad los valores detallados,
          que fueran rechazados por el banco girado según el motivo indicado. Con la entrega
          de los mismos, la gestión de cobranza sobre dichos valores queda concluida.
        </p>

        <div className="mt-16 grid grid-cols-2 gap-12 text-center text-sm">
          <div>
            <div className="border-t border-black pt-2">Entregó (firma y aclaración)</div>
          </div>
          <div>
            <div className="border-t border-black pt-2">Recibió (firma, aclaración y DNI)</div>
          </div>
        </div>
      </div>
    </main>
  );
}
