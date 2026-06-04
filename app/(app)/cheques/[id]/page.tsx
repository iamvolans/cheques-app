import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

const colorEstado: Record<string, string> = {
  aceptado: "bg-zinc-800 text-zinc-300",
  depositado: "bg-blue-950 text-blue-300",
  procesado: "bg-emerald-950 text-emerald-300",
  rechazado: "bg-red-950 text-red-300",
};

function Doc({ titulo, url }: { titulo: string; url: string | null }) {
  if (!url) return null;
  const preview = url.replace("/view", "/preview");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-zinc-500">{titulo}</p>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-emerald-400 hover:underline">
          Abrir en Drive ↗
        </a>
      </div>
      <iframe src={preview} className="h-72 w-full rounded-lg border border-zinc-800 bg-zinc-900" allow="autoplay" />
    </div>
  );
}

export default async function DetalleChequePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const [{ data: ch }, { data: logs }] = await Promise.all([
    supabase
      .from("cheques")
      .select("*, clientes(id, razon_social), convenios(razon_social), cuentas_bancarias_empresa(banco, alias)")
      .eq("id", id)
      .single(),
    supabase
      .from("logs_auditoria")
      .select("*")
      .eq("tabla", "cheques")
      .eq("registro_id", id)
      .order("created_at"),
  ]);

  if (!ch) notFound();

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const campos: [string, string][] = [
    ["Tipo", ch.tipo === "echeq" ? "E-Cheq" : "Cheque físico"],
    ["Librador", ch.librador],
    ["CUIT librador", ch.cuit_librador],
    ["Monto", fmtARS.format(Number(ch.monto))],
    ["Fee aplicado", `${Number(ch.fee_aplicado_pct).toFixed(2)}% → ${fmtARS.format(Number(ch.fee_calculado))}`],
    ["Multa", fmtARS.format(Number(ch.multa))],
    ["Endosos", String(ch.endosos)],
    ["Banco emisor", ch.banco_emisor],
    ["Convenio", ch.convenios?.razon_social ?? "—"],
    ["Cuenta de ingreso", `${ch.cuentas_bancarias_empresa?.banco ?? "—"}${ch.cuentas_bancarias_empresa?.alias ? " · " + ch.cuentas_bancarias_empresa.alias : ""}`],
    ["Fecha de cobro", ch.fecha_cobro],
    ["Fecha de depósito", ch.fecha_deposito ?? "—"],
    ["Acreditación estimada", ch.fecha_estimada_acred ?? "—"],
    ["Portador al banco", ch.portador_banco ?? "—"],
    ["ID de E-Cheq", ch.echeq_id ?? "—"],
    ["Motivo de rechazo", ch.motivo_rechazo ?? "—"],
  ];

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 pb-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-zinc-50">
              Cheque N° {ch.numero_cheque}
              {ch.alerta_lista_negra && (
                <span className="ml-2 rounded bg-red-950 px-2 py-0.5 text-xs font-semibold text-red-300">LISTA NEGRA</span>
              )}
            </h1>
            <p className="text-sm text-zinc-400">
              Cliente:{" "}
              <Link href={`/clientes/${ch.clientes?.id}`} className="text-emerald-400 hover:underline">
                {ch.clientes?.razon_social}
              </Link>
            </p>
            <Link href="/cheques" className="text-sm text-zinc-400 hover:text-zinc-200">← Volver a cheques</Link>
          </div>
          <span className={`rounded px-3 py-1 text-sm font-medium uppercase ${colorEstado[ch.estado] ?? ""}`}>
            {ch.estado}
          </span>
        </header>

        <section className="grid gap-x-8 gap-y-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-6 shadow-lg shadow-black/20 sm:grid-cols-2">
          {campos.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-zinc-800/50 pb-2 text-sm">
              <span className="text-zinc-500">{k}</span>
              <span className="text-right font-mono text-zinc-100">{v}</span>
            </div>
          ))}
        </section>

        {(ch.foto_frente_url || ch.foto_dorso_url || ch.pdf_endoso_url) && (
          <section className="grid gap-6 sm:grid-cols-2">
            <Doc titulo="Foto frente" url={ch.foto_frente_url} />
            <Doc titulo="Foto dorso" url={ch.foto_dorso_url} />
            <Doc titulo="PDF de endoso" url={ch.pdf_endoso_url} />
          </section>
        )}

        <section>
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-zinc-400">
            Historial del cheque
          </h2>
          <div className="space-y-0 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20">
            {(logs ?? []).map((l) => (
              <div key={l.id} className="flex gap-4 border-l-2 border-zinc-700 py-2 pl-4 text-sm">
                <span className="w-44 shrink-0 font-mono text-xs text-zinc-500">
                  {new Date(l.created_at).toLocaleString("es-AR")}
                </span>
                <span className="text-zinc-100">
                  {l.descripcion}
                  <span className="text-zinc-500"> — {l.usuario_email ?? "sistema"}</span>
                </span>
              </div>
            ))}
            {(logs ?? []).length === 0 && <p className="text-sm text-zinc-500">Sin historial.</p>}
          </div>
        </section>
      </div>
    </main>
  );
}
