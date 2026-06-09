"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearCheque, type EstadoCheque } from "@/actions/cheques";
import InputCuit from "@/components/ui/input-cuit";

type Opcion = { id: string; nombre: string };
const inicial: EstadoCheque = { error: null };

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}
function maxDiferidoISO() {
  const d = new Date();
  d.setDate(d.getDate() + 90);
  return d.toISOString().slice(0, 10);
}

// Comprime imágenes pesadas en el navegador antes de subirlas (límite de Vercel: ~4,5 MB por request)
async function comprimirImagen(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size <= 700 * 1024) return file;
  try {
    const bmp = await createImageBitmap(file, { imageOrientation: "from-image" });
    const escala = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bmp.width * escala);
    canvas.height = Math.round(bmp.height * escala);
    canvas.getContext("2d")!.drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.82));
    if (!blob) return file;
    return new File([blob.size < file.size ? blob : file], file.name.replace(/\.\w+$/, "") + ".jpg", {
      type: "image/jpeg",
    });
  } catch {
    return file;
  }
}

async function alElegirImagen(e: React.ChangeEvent<HTMLInputElement>) {
  const f = e.target.files?.[0];
  if (!f) return;
  const comprimida = await comprimirImagen(f);
  if (comprimida !== f) {
    const dt = new DataTransfer();
    dt.items.add(comprimida);
    e.target.files = dt.files;
  }
}

const lbl = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-zinc-500";
const inputCls =
  "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm normal-case tracking-normal text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15";

function Campo({ etiqueta, extra, children }: { etiqueta: string; extra?: React.ReactNode; children: React.ReactNode }) {
  return (
    <label className={lbl}>
      <span>{etiqueta}{extra}</span>
      {children}
    </label>
  );
}

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
  const [cp, setCp] = useState("");
  const [fecha, setFecha] = useState("");
  const [estado, accion, pendiente] = useActionState(crearCheque, inicial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      setCp("");
      setFecha("");
    }
  }, [estado]);

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

  const cpNum = Number(cp);
  const plaza = cp && cpNum >= 1 && cpNum <= 9999 ? (cpNum <= 2000 ? "camara" : "interior") : null;
  const esDiferido = fecha !== "" && fecha > hoyISO();

  return (
    <form
      ref={formRef}
      action={accion}
      className="grid w-full gap-x-4 gap-y-3 rounded-2xl border border-zinc-800 bg-gradient-to-b from-zinc-900 to-zinc-950 p-5 shadow-lg shadow-black/20 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Campo etiqueta="Tipo de valor">
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "fisico" | "echeq")} className={inputCls}>
          <option value="fisico">Cheque físico</option>
          <option value="echeq">E-Cheq</option>
        </select>
      </Campo>
      <Campo etiqueta="N° de cheque *">
        <input name="numero_cheque" placeholder="ej: 00012345" required className={inputCls} />
      </Campo>
      <Campo etiqueta="Fecha de cobro * (futura = diferido)">
        <input
          name="fecha_cobro"
          type="date"
          required
          max={maxDiferidoISO()}
          value={fecha}
          onChange={(e) => setFecha(e.target.value)}
          className={inputCls}
        />
      </Campo>

      <Campo etiqueta="Librador *">
        <input name="librador" placeholder="Razón social del emisor" required className={inputCls} />
      </Campo>
      <Campo etiqueta="CUIT del librador *">
        <InputCuit name="cuit_librador" placeholder="30-12345678-9" required className={inputCls} />
      </Campo>
      <Campo etiqueta="Monto ARS *">
        <input name="monto" type="number" step="0.01" min="0.01" placeholder="0,00" required className={inputCls} />
      </Campo>

      <Campo etiqueta="Banco emisor *">
        <input name="banco_emisor" placeholder="ej: Banco Nación" required className={inputCls} />
      </Campo>
      <Campo
        etiqueta="CP del librador"
        extra={
          <>
            {plaza === "camara" && <span className="ml-2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">CÁMARA</span>}
            {plaza === "interior" && <span className="ml-2 rounded-full bg-violet-500/15 px-2 py-0.5 text-[10px] font-semibold text-violet-300">INTERIOR</span>}
          </>
        }
      >
        <input
          name="codigo_postal"
          type="number"
          min="1"
          max="9999"
          placeholder="ej: 1426 ó 5000"
          value={cp}
          onChange={(e) => setCp(e.target.value)}
          className={inputCls}
        />
      </Campo>
      <Campo etiqueta="Endosos">
        <input name="endosos" type="number" min="0" defaultValue={0} className={inputCls} />
      </Campo>

      {tipo === "echeq" ? (
        <Campo etiqueta="ID único de E-Cheq *">
          <input name="echeq_id" placeholder="Identificador del e-cheq" required className={inputCls} />
        </Campo>
      ) : (
        <Campo etiqueta="Portador al banco">
          <input name="portador_banco" placeholder="¿Quién lo lleva a depositar?" className={inputCls} />
        </Campo>
      )}
      <Campo etiqueta="Cliente *">
        <select name="cliente_id" required className={inputCls} defaultValue="">
          <option value="" disabled>Elegir cliente…</option>
          {clientes.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>
      <Campo etiqueta="Convenio (a quién se factura) *">
        <select name="convenio_id" required className={inputCls} defaultValue="">
          <option value="" disabled>Elegir convenio…</option>
          {convenios.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>

      <Campo etiqueta="Cuenta propia de ingreso *">
        <select name="cuenta_bancaria_id" required className={inputCls} defaultValue="">
          <option value="" disabled>Elegir cuenta…</option>
          {cuentas.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
        </select>
      </Campo>
      {tipo === "fisico" ? (
        <>
          <Campo etiqueta="Foto frente">
            <input name="foto_frente" type="file" accept="image/*" onChange={alElegirImagen} className="mt-0.5 block w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-xs file:text-zinc-100" />
          </Campo>
          <Campo etiqueta="Foto dorso">
            <input name="foto_dorso" type="file" accept="image/*" onChange={alElegirImagen} className="mt-0.5 block w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-xs file:text-zinc-100" />
          </Campo>
        </>
      ) : (
        <>
          <Campo etiqueta="PDF de endoso">
            <input name="pdf_endoso" type="file" accept="application/pdf" className="mt-0.5 block w-full text-xs text-zinc-400 file:mr-2 file:rounded-lg file:border-0 file:bg-zinc-700 file:px-3 file:py-2 file:text-xs file:text-zinc-100" />
          </Campo>
          <span className="hidden lg:block" />
        </>
      )}

      {esDiferido && (
        <p className="rounded-lg border border-amber-900 bg-amber-950/60 px-3 py-2 text-sm normal-case tracking-normal text-amber-300 sm:col-span-2 lg:col-span-3">
          ⏳ Cheque diferido: quedará <strong>EN CUSTODIA</strong> y recién se podrá depositar el {fecha}.
        </p>
      )}
      {estado.error && (
        <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm normal-case tracking-normal text-red-300 sm:col-span-2 lg:col-span-3">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-lg border border-emerald-900 bg-emerald-950 px-3 py-2 text-sm normal-case tracking-normal text-emerald-300 sm:col-span-2 lg:col-span-3">
          ✓ Cheque cargado correctamente.{" "}
          {estado.alerta && <span className="font-semibold text-amber-400">{estado.alerta}</span>}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
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
