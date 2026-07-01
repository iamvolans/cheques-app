import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import EliminarCheque from "@/components/admin/eliminar-cheque";
import CorregirCheque from "@/components/admin/corregir-cheque";
import CorregirEstado from "@/components/admin/corregir-estado";
import ReasignarCheque from "@/components/admin/reasignar-cheque";
import EditarDatosCheque from "@/components/admin/editar-datos-cheque";

const colorEstado: Record<string, string> = {
  aceptado: "bg-muted text-foreground/90",
  depositado: "bg-info-muted text-info",
  procesado: "bg-success-muted text-primary",
  rechazado: "bg-danger-muted text-danger",
  en_custodia: "bg-warning-muted text-warning",
};

function Doc({ titulo, url }: { titulo: string; url: string | null }) {
  if (!url) return null;
  const preview = url.replace("/view", "/preview");
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-wide text-muted-foreground">{titulo}</p>
        <a href={url} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
          Abrir en Drive ↗
        </a>
      </div>
      <iframe src={preview} className="h-72 w-full rounded-lg border border-border bg-card" allow="autoplay" />
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

  const [{ data: ch }, { data: logs }, { data: miPerfil }, { data: listaClientes }, { data: listaBancos }] = await Promise.all([
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
    supabase.from("perfiles").select("rol").eq("id", user.id).single(),
    supabase.from("clientes").select("id, razon_social").eq("activo", true).order("razon_social"),
    supabase.from("bancos").select("nombre").eq("activo", true).order("orden"),
  ]);

  if (!ch) notFound();

  const esAdmin = miPerfil?.rol === "administrador";

  const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });
  const campos: [string, string][] = [
    ["Tipo", ch.tipo === "echeq" ? "E-Cheq" : "Cheque físico"],
    ["Librador", ch.librador],
    ["CUIT librador", ch.cuit_librador],
    ["Monto", fmtARS.format(Number(ch.monto))],
    ["Fee aplicado", `${Number(ch.fee_aplicado_pct).toFixed(2)}% → ${fmtARS.format(Number(ch.fee_calculado))}`],
    ["Multa al cliente", fmtARS.format(Number(ch.multa))],
    ["Gasto bancario (interno)", fmtARS.format(Number(ch.gasto_bancario ?? 0))],
    ["Plaza / CP", ch.plaza ? `${ch.plaza === "camara" ? "Cámara" : "Interior"} (CP ${ch.codigo_postal})` : "—"],
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
    <main className="min-h-screen bg-background p-4 sm:p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight text-foreground">
              Cheque N° {ch.numero_cheque}
              {ch.alerta_lista_negra && (
                <span className="ml-2 rounded bg-danger-muted px-2 py-0.5 text-xs font-semibold text-danger">LISTA NEGRA</span>
              )}
            </h1>
            <p className="text-sm text-muted-foreground">
              Cliente:{" "}
              <Link href={`/clientes/${ch.clientes?.id}`} className="text-primary hover:underline">
                {ch.clientes?.razon_social}
              </Link>
            </p>
            <Link href="/cheques" className="text-sm text-muted-foreground hover:text-foreground">← Volver a cheques</Link>
          </div>
          <span className={`rounded px-3 py-1 text-sm font-medium uppercase ${colorEstado[ch.estado] ?? ""}`}>
            {ch.estado === "en_custodia" ? "custodia" : ch.estado}
          </span>
        </header>

        <section className="grid gap-x-8 gap-y-3 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-6 shadow-lg shadow-foreground/5 sm:grid-cols-2">
          {campos.map(([k, v]) => (
            <div key={k} className="flex justify-between gap-4 border-b border-border-subtle pb-2 text-sm">
              <span className="text-muted-foreground">{k}</span>
              <span className="text-right font-mono text-foreground">{v}</span>
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
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wide text-muted-foreground">
            Historial del cheque
          </h2>
          <div className="space-y-0 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5">
            {(logs ?? []).map((l) => (
              <div key={l.id} className="flex gap-4 border-l-2 border-border py-2 pl-4 text-sm">
                <span className="w-44 shrink-0 font-mono text-xs text-muted-foreground">
                  {new Date(l.created_at).toLocaleString("es-AR")}
                </span>
                <span className="text-foreground">
                  {l.descripcion}
                  <span className="text-muted-foreground"> — {l.usuario_email ?? "sistema"}</span>
                </span>
              </div>
            ))}
            {(logs ?? []).length === 0 && <p className="text-sm text-muted-foreground">Sin historial.</p>}
          </div>
        </section>

        {esAdmin && (
          <EditarDatosCheque
            chequeId={ch.id}
            numero={ch.numero_cheque}
            librador={ch.librador}
            cuit={ch.cuit_librador}
            banco={ch.banco_emisor ?? ""}
            bancos={(listaBancos ?? []).map((b) => b.nombre)}
            cp={ch.codigo_postal ?? null}
            fechaCobro={ch.fecha_cobro}
            fechaAcred={ch.fecha_estimada_acred ?? null}
          />
        )}
        {esAdmin && (
          <ReasignarCheque
            chequeId={ch.id}
            numero={ch.numero_cheque}
            clienteActualId={ch.clientes?.id ?? ch.cliente_id}
            clientes={listaClientes ?? []}
          />
        )}
        {esAdmin && (
          <CorregirCheque chequeId={ch.id} numero={ch.numero_cheque} monto={Number(ch.monto)} />
        )}
        {esAdmin && (
          <CorregirEstado chequeId={ch.id} numero={ch.numero_cheque} estadoActual={ch.estado} />
        )}
        {esAdmin && ["aceptado", "en_custodia"].includes(ch.estado) && (
          <EliminarCheque chequeId={ch.id} numero={ch.numero_cheque} />
        )}
      </div>
    </main>
  );
}
