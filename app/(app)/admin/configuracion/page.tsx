import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import FormConfig from "@/components/admin/form-config";
import BotonConfig from "@/components/admin/boton-config";
import MultaCuenta from "@/components/admin/multa-cuenta";
import {
  agregarListaNegra, quitarListaNegra,
  agregarConvenio, toggleConvenio,
  agregarCuenta, toggleCuenta,
  agregarFeriado, quitarFeriado, sincronizarFeriados,
} from "@/actions/configuracion";

export default async function ConfiguracionPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (aal?.nextLevel === "aal1") redirect("/mfa-setup");
  if (aal?.currentLevel !== "aal2") redirect("/mfa-verify");

  const { data: miPerfil } = await supabase
    .from("perfiles").select("rol").eq("id", user.id).single();
  if (miPerfil?.rol !== "administrador") redirect("/dashboard");

  const hoy = new Date().toISOString().slice(0, 10);
  const [{ data: listaNegra }, { data: convenios }, { data: cuentas }, { data: feriados }] =
    await Promise.all([
      supabase.from("lista_negra_libradores").select("*").order("created_at", { ascending: false }),
      supabase.from("convenios").select("*").order("razon_social"),
      supabase.from("cuentas_bancarias_empresa").select("*").order("banco"),
      supabase.from("feriados").select("*").gte("fecha", hoy).order("fecha"),
    ]);

  const seccion = "rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20 space-y-4";
  const titulo = "text-sm font-medium uppercase tracking-wide text-zinc-400";
  const fila = "flex flex-wrap items-center justify-between gap-2 border-b border-zinc-800 py-2 text-sm last:border-0";

  return (
    <main className="min-h-screen bg-zinc-950 p-8">
      <div className="mx-auto max-w-5xl space-y-8">
        <header className="border-b border-zinc-800 pb-4">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">Configuración</h1>
          
        </header>

        <section className={seccion}>
          <h2 className={titulo}>🚫 Lista negra de libradores</h2>
          <FormConfig
            accion={agregarListaNegra}
            etiqueta="Bloquear librador"
            campos={[
              { name: "cuit", placeholder: "CUIT *" },
              { name: "razon_social", placeholder: "Razón social" },
              { name: "motivo", placeholder: "Motivo" },
            ]}
          />
          {(listaNegra ?? []).map((l) => (
            <div key={l.id} className={fila}>
              <span className="text-zinc-100">
                <span className="font-mono text-zinc-400">{l.cuit}</span>
                {l.razon_social && ` · ${l.razon_social}`}
                <span className="text-zinc-500"> — {l.motivo}</span>
              </span>
              <BotonConfig accion={quitarListaNegra} payload={{ id: l.id }} label="Quitar" peligro />
            </div>
          ))}
          {(listaNegra ?? []).length === 0 && <p className="text-sm text-zinc-500">Sin libradores bloqueados.</p>}
        </section>

        <section className={seccion}>
          <h2 className={titulo}>📋 Convenios (a quién se factura la comisión)</h2>
          <FormConfig
            accion={agregarConvenio}
            etiqueta="Agregar convenio"
            campos={[
              { name: "razon_social", placeholder: "Razón social *" },
              { name: "cuit", placeholder: "CUIT *" },
            ]}
          />
          {(convenios ?? []).map((c) => (
            <div key={c.id} className={fila}>
              <span className={c.activo ? "text-zinc-100" : "text-zinc-500 line-through"}>
                {c.razon_social} <span className="font-mono text-zinc-400">{c.cuit}</span>
              </span>
              <BotonConfig
                accion={toggleConvenio}
                payload={{ id: c.id, activo: !c.activo }}
                label={c.activo ? "Desactivar" : "Reactivar"}
                peligro={c.activo}
              />
            </div>
          ))}
        </section>

        <section className={seccion}>
          <h2 className={titulo}>🏦 Cuentas bancarias propias</h2>
          <FormConfig
            accion={agregarCuenta}
            etiqueta="Agregar cuenta"
            campos={[
              { name: "banco", placeholder: "Banco *" },
              { name: "alias", placeholder: "Alias" },
              { name: "cbu", placeholder: "CBU" },
              { name: "descripcion", placeholder: "Descripción" },
              { name: "multa_rechazo_banco", placeholder: "Multa por rechazo ARS", type: "number" },
            ]}
          />
          {(cuentas ?? []).map((c) => (
            <div key={c.id} className={fila}>
              <span className={c.activa ? "text-zinc-100" : "text-zinc-500 line-through"}>
                {c.banco}{c.alias && <span className="text-zinc-400"> · {c.alias}</span>}
                {c.descripcion && <span className="text-zinc-500"> — {c.descripcion}</span>}
              </span>
              <MultaCuenta id={c.id} multa={Number(c.multa_rechazo_banco ?? 0)} />
              <BotonConfig
                accion={toggleCuenta}
                payload={{ id: c.id, activa: !c.activa }}
                label={c.activa ? "Desactivar" : "Reactivar"}
                peligro={c.activa}
              />
            </div>
          ))}
        </section>

        <section className={seccion}>
          <h2 className={titulo}>📅 Feriados (para el cálculo de 48hs hábiles)</h2>
          <FormConfig
            accion={agregarFeriado}
            etiqueta="Agregar feriado"
            campos={[
              { name: "fecha", placeholder: "Fecha *", type: "date" },
              { name: "descripcion", placeholder: "Descripción" },
            ]}
          />
          <BotonConfig
            accion={sincronizarFeriados}
            payload={{}}
            label="🔄 Sincronizar desde API (año actual + próximo)"
          />
          {(feriados ?? []).map((f) => (
            <div key={f.fecha} className={fila}>
              <span className="text-zinc-100">
                <span className="font-mono text-zinc-400">{f.fecha}</span> · {f.descripcion}
              </span>
              <BotonConfig accion={quitarFeriado} payload={{ fecha: f.fecha }} label="Quitar" peligro />
            </div>
          ))}
          <p className="text-xs text-zinc-500">
            Se muestran solo los feriados futuros. Acordate de cargar los del año nuevo cada diciembre.
          </p>
        </section>
      </div>
    </main>
  );
}
