"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearCheque, type EstadoCheque } from "@/actions/cheques";

type Opcion = { id: string; nombre: string };
const inicial: EstadoCheque = { error: null };

export default function NuevoCheque({
  clientes,
  convenios,
  cuentas,
}: {
  clientes: Opcion[];
  convenios: Opcion[];
  cuentas: Opcion[];
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"fisico" | "echeq">("fisico");
  const [estado, accion, pendiente] = useActionState(crearCheque, inicial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) formRef.current?.reset();
  }, [estado]);

  const inputCls =
    "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500"
      >
        + Cargar cheque
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={accion}
      className="grid w-full gap-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20 sm:grid-cols-3"
    >
      <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "fisico" | "echeq")} className={inputCls}>
        <option value="fisico">Cheque físico</option>
        <option value="echeq">E-Cheq</option>
      </select>
      <input name="numero_cheque" placeholder="N° de cheque *" required className={inputCls} />
      <input name="fecha_cobro" type="date" required className={inputCls} title="Fecha de cobro" />

      <input name="librador" placeholder="Librador *" required className={inputCls} />
      <input name="cuit_librador" placeholder="CUIT librador *" required className={inputCls} />
      <input name="monto" type="number" step="0.01" min="0.01" placeholder="Monto ARS *" required className={inputCls} />

      <input name="banco_emisor" placeholder="Banco emisor *" required className={inputCls} />
      <input name="endosos" type="number" min="0" defaultValue={0} placeholder="Endosos" className={inputCls} />
      {tipo === "echeq" ? (
        <input name="echeq_id" placeholder="ID único de E-Cheq *" required className={inputCls} />
      ) : (
        <input name="portador_banco" placeholder="¿Quién lo lleva al banco?" className={inputCls} />
      )}

      <select name="cliente_id" required className={inputCls} defaultValue="">
        <option value="" disabled>Cliente *</option>
        {clientes.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <select name="convenio_id" required className={inputCls} defaultValue="">
        <option value="" disabled>Convenio (a quién se factura) *</option>
        {convenios.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <select name="cuenta_bancaria_id" required className={inputCls} defaultValue="">
        <option value="" disabled>Cuenta propia de ingreso *</option>
        {cuentas.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>


      {tipo === "fisico" ? (
        <>
          <label className="text-xs text-zinc-400">Foto FRENTE
            <input name="foto_frente" type="file" accept="image/*" className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-100" />
          </label>
          <label className="text-xs text-zinc-400">Foto DORSO
            <input name="foto_dorso" type="file" accept="image/*" className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-100" />
          </label>
          <span />
        </>
      ) : (
        <>
          <label className="text-xs text-zinc-400">PDF de endoso
            <input name="pdf_endoso" type="file" accept="application/pdf" className="mt-1 block w-full text-xs text-zinc-400 file:mr-2 file:rounded file:border-0 file:bg-zinc-700 file:px-2 file:py-1 file:text-xs file:text-zinc-100" />
          </label>
          <span /><span />
        </>
      )}

      {estado.error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300 sm:col-span-3">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm text-emerald-300 sm:col-span-3">
          ✓ Cheque cargado correctamente. {estado.alerta && (
            <span className="font-semibold text-amber-400">{estado.alerta}</span>
          )}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-3">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-emerald-500 disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar cheque"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 transition hover:bg-zinc-800"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
