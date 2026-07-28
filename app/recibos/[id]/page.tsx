import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import BotonImprimir from "@/components/ui/boton-imprimir";
import AnularRecibo from "@/components/recibos/anular-recibo";
import FirmaRecibo from "@/components/recibos/firma-recibo";

export const metadata = { title: "Recibo de devolución" };
const ars = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default async function ReciboPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: rec }, { data: items }, { data: perfil }] = await Promise.all([
    supabase
      .from("recibos_devolucion")
      .select("*, clientes(razon_social, cuit)")
      .eq("id", id)
      .single(),
    supabase
      .from("recibos_devolucion_items")
      .select("*")
      .eq("recibo_id", id)
      .order("numero_cheque"),
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
  ]);
  if (!rec) notFound();

  const esAdmin = perfil?.rol === "administrador";
  const cli = rec.clientes as unknown as { razon_social?: string; cuit?: string } | null;
  const fecha = new Date(rec.fecha + "T12:00:00").toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  });

  return (
    <main className="min-h-screen bg-white p-8 text-black print:p-4">
      <div className="mx-auto max-w-3xl space-y-6">
        <div className="print:hidden">
          <Link href="/cheques" className="text-sm text-neutral-500 hover:text-black">← Volver a cheques</Link>
        </div>

        {rec.estado === "anulado" && (
          <div className="rounded border-2 border-red-600 bg-red-50 px-4 py-2 text-sm font-semibold uppercase text-red-700">
            Recibo anulado el {new Date(rec.anulado_at).toLocaleString("es-AR")} · {rec.anulado_motivo}
          </div>
        )}

        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div>
            <h1 className="text-xl font-bold uppercase tracking-wide">
              Recibo de devolución de valores rechazados
            </h1>
            <p className="mt-1 text-sm">
              N° {String(rec.numero).padStart(6, "0")} · Fecha: {fecha}
            </p>
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
            {(items ?? []).map((c) => (
              <tr key={c.id} className="border-b border-neutral-300">
                <td className="py-2 pr-3 font-mono">{c.numero_cheque}</td>
                <td className="py-2 pr-3">
                  {c.librador}
                  <br />
                  <span className="text-xs text-neutral-600">{c.cuit_librador}</span>
                </td>
                <td className="py-2 pr-3">{c.banco_emisor}</td>
                <td className="py-2 pr-3">{c.motivo_rechazo ?? "—"}</td>
                <td className="py-2 text-right font-mono">{ars.format(Number(c.monto))}</td>
              </tr>
            ))}
            <tr>
              <td colSpan={4} className="py-2 pr-3 text-right font-semibold">
                Total ({rec.cantidad} valor{rec.cantidad === 1 ? "" : "es"})
              </td>
              <td className="py-2 text-right font-mono font-bold">{ars.format(Number(rec.total))}</td>
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
            {rec.firma_png && (
              <div className="flex h-24 items-end justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={rec.firma_png} alt="Firma de quien recibe" className="max-h-24" />
              </div>
            )}
            <div className="border-t border-black pt-2">
              Recibió (firma, aclaración y DNI)
              {rec.firma_aclaracion && (
                <div className="mt-1 text-xs">
                  {rec.firma_aclaracion} · DNI {rec.firma_dni}
                  <br />
                  <span className="text-neutral-600">
                    Firmado el {new Date(rec.firma_at).toLocaleString("es-AR")}
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {rec.estado === "emitido" && <FirmaRecibo reciboId={rec.id} />}

        {rec.firma_hash && (
          <p className="break-all text-[10px] text-neutral-500">
            Huella SHA-256: {rec.firma_hash}
          </p>
        )}

        {esAdmin && rec.estado !== "anulado" && (
          <div className="print:hidden">
            <AnularRecibo reciboId={rec.id} numero={rec.numero} />
          </div>
        )}
      </div>
    </main>
  );
}
