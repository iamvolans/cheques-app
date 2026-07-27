"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearCheque, type EstadoCheque } from "@/actions/cheques";
import { abrirLote, cerrarLote, type Lote } from "@/actions/lotes";
import InputCuit from "@/components/ui/input-cuit";
import InputMonto from "@/components/ui/input-monto";
import InputBanco from "@/components/ui/input-banco";
import AlertaRiesgoLibrador from "@/components/cheques/alerta-riesgo-librador";

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

const lbl = "flex flex-col gap-1 text-[11px] uppercase tracking-wide text-muted-foreground";
const inputCls =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm normal-case tracking-normal text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

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
  bancos,
  loteAbierto,
  proximaFoto,
}: {
  clientes: Opcion[];
  convenios: Opcion[];
  cuentas: Opcion[];
  bancos: string[];
  loteAbierto?: Lote | null;
  proximaFoto?: number;
}) {
  const [abierto, setAbierto] = useState(false);
  const [tipo, setTipo] = useState<"fisico" | "echeq">("fisico");
  const [cp, setCp] = useState("");
  const [cuitLibrador, setCuitLibrador] = useState("");
  const [fecha, setFecha] = useState("");
  const [fechaCarga, setFechaCarga] = useState(hoyISO());
  const [fechaDep, setFechaDep] = useState("");
  const [lote, setLote] = useState<Lote | null>(loteAbierto ?? null);
  const [clienteId, setClienteId] = useState(loteAbierto?.cliente_id ?? "");
  const [fotoNum, setFotoNum] = useState(String(proximaFoto ?? 1));
  const [loteErr, setLoteErr] = useState<string | null>(null);
  const [loteOcupado, setLoteOcupado] = useState(false);
  const [estado, accion, pendiente] = useActionState(crearCheque, inicial);
  const [resetTick, setResetTick] = useState(0);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      setCp("");
      setFecha("");
      setFechaCarga(hoyISO());
      setFechaDep("");
      setCuitLibrador("");
      setResetTick((t) => t + 1);
      if (lote) setFotoNum(String((estado.foto ?? 0) + 1));
      else setClienteId("");
    }
  }, [estado]);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary"
      >
        + Cargar cheque
      </button>
    );
  }

  const cpNum = Number(cp);
  const plaza = cp && cpNum >= 1 && cpNum <= 9999 ? (cpNum <= 2000 ? "camara" : "interior") : null;
  const esDiferido = fecha !== "" && fecha > hoyISO();
  const conflicto = esDiferido && fechaDep !== "";

  return (
    <form
      ref={formRef}
      action={accion}
      className="grid w-full gap-x-4 gap-y-3 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5 sm:grid-cols-2 lg:grid-cols-3"
    >
      <Campo etiqueta="Fecha de carga *">
        <input name="fecha_carga" type="date" required min="2000-01-01" max={hoyISO()}
          value={fechaCarga} onChange={(e) => setFechaCarga(e.target.value)} className={inputCls} />
        <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80">
          Fecha en que se ingresa el cheque al sistema
        </span>
      </Campo>
      <Campo etiqueta="Fecha de pago del cheque * (futura = diferido)">
        <input name="fecha_cobro" type="date" required min="2000-01-01" max={maxDiferidoISO()}
          value={fecha} onChange={(e) => setFecha(e.target.value)} className={inputCls} />
        <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80">
          Fecha del cheque: si es futura queda en custodia
        </span>
      </Campo>
      <Campo etiqueta="Fecha de depósito (opcional)">
        <input name="fecha_deposito" type="date" min="2000-01-01" max={hoyISO()}
          value={fechaDep} onChange={(e) => setFechaDep(e.target.value)} className={inputCls} />
        <span className="text-[10px] normal-case tracking-normal text-muted-foreground/80">
          Solo si ya se presentó en el banco: nace EN CLEARING
        </span>
      </Campo>
      <Campo etiqueta="Tipo de valor">
        <select name="tipo" value={tipo} onChange={(e) => setTipo(e.target.value as "fisico" | "echeq")} className={inputCls}>
          <option value="fisico">Cheque físico</option>
          <option value="echeq">E-Cheq</option>
        </select>
      </Campo>
      <Campo etiqueta="N° de cheque *">
        <input name="numero_cheque" placeholder="ej: 00012345" required className={inputCls} />
      </Campo>
      <Campo etiqueta="Librador *">
        <input name="librador" placeholder="Razón social del emisor" required className={inputCls} />
      </Campo>
      <Campo etiqueta="CUIT del librador *">
        <InputCuit key={`cuit-${resetTick}`} name="cuit_librador" placeholder="30-12345678-9" required className={inputCls} onValor={setCuitLibrador} />
        <AlertaRiesgoLibrador cuit={cuitLibrador} />
      </Campo>
      <Campo etiqueta="Monto ARS *">
        <InputMonto key={`monto-${resetTick}`} name="monto" placeholder="0,00" required className={inputCls} />
      </Campo>

      <Campo etiqueta="Banco emisor *">
        <InputBanco key={`banco-${resetTick}`} name="banco_emisor" bancos={bancos} required className={inputCls} />
      </Campo>
      <Campo
        etiqueta="C.P. sucursal Bancaria *"
        extra={
          <>
            {plaza === "camara" && <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">CÁMARA</span>}
            {plaza === "interior" && <span className="ml-2 rounded-full bg-info/15 px-2 py-0.5 text-[10px] font-semibold text-info">INTERIOR</span>}
          </>
        }
      >
        <input
          name="codigo_postal"
          type="number"
          min="1"
          max="9999"
          required
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
      <Campo etiqueta={lote ? "Cliente * (fijado por el lote)" : "Cliente *"}>
        <input type="hidden" name="cliente_id" value={clienteId} />
        <select
          required
          disabled={Boolean(lote)}
          value={clienteId}
          onChange={(e) => setClienteId(e.target.value)}
          className={inputCls + (lote ? " opacity-70" : "")}
        >
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
            <input name="foto_frente" type="file" accept="image/*" onChange={alElegirImagen} className="mt-0.5 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground" />
          </Campo>
          <Campo etiqueta="Foto dorso">
            <input name="foto_dorso" type="file" accept="image/*" onChange={alElegirImagen} className="mt-0.5 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground" />
          </Campo>
        </>
      ) : (
        <>
          <Campo etiqueta="PDF de endoso">
            <input name="pdf_endoso" type="file" accept="application/pdf" className="mt-0.5 block w-full text-xs text-muted-foreground file:mr-2 file:rounded-lg file:border-0 file:bg-muted file:px-3 file:py-2 file:text-xs file:text-foreground" />
          </Campo>
          <span className="hidden lg:block" />
        </>
      )}

      {conflicto && (
        <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-sm normal-case tracking-normal text-danger sm:col-span-2 lg:col-span-3">
          No se puede poner fecha de depósito en un cheque diferido: la fecha de pago ({fecha}) todavía no llegó.
        </p>
      )}
      {!conflicto && fechaDep !== "" && (
        <p className="rounded-lg border border-info/40 bg-info-muted/60 px-3 py-2 text-sm normal-case tracking-normal text-info sm:col-span-2 lg:col-span-3">
          Este cheque se va a cargar ya <strong>EN CLEARING</strong>, con fecha de depósito {fechaDep}.
        </p>
      )}
      {esDiferido && (
        <p className="rounded-lg border border-amber-900 bg-warning-muted/60 px-3 py-2 text-sm normal-case tracking-normal text-warning sm:col-span-2 lg:col-span-3">
          ⏳ Cheque diferido: quedará <strong>EN CUSTODIA</strong> y recién se podrá depositar el {fecha}.
        </p>
      )}
      {estado.error && (
        <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-sm normal-case tracking-normal text-danger sm:col-span-2 lg:col-span-3">
          {estado.error}
        </p>
      )}
      {estado.ok && (
        <p className="rounded-lg border border-emerald-900 bg-success-muted px-3 py-2 text-sm normal-case tracking-normal text-primary sm:col-span-2 lg:col-span-3">
          ✓ Cheque cargado correctamente.{" "}
          {estado.alerta && <span className="font-semibold text-warning">{estado.alerta}</span>}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-card/60 p-2 sm:col-span-2 lg:col-span-3">
        {!lote ? (
          <button
            type="button"
            disabled={loteOcupado || clienteId === ""}
            onClick={async () => {
              setLoteErr(null); setLoteOcupado(true);
              const r = await abrirLote(clienteId);
              setLoteOcupado(false);
              if (r.error) { setLoteErr(r.error); return; }
              setLote(r.lote ?? null); setFotoNum("1");
            }}
            className="rounded-lg bg-blue-800 px-3 py-1.5 text-xs font-medium text-blue-100 transition hover:bg-blue-700 disabled:opacity-50"
          >
            Abrir lote
          </button>
        ) : (
          <button
            type="button"
            disabled={loteOcupado}
            onClick={async () => {
              setLoteErr(null); setLoteOcupado(true);
              const r = await cerrarLote(lote.id);
              setLoteOcupado(false);
              if (r.error) { setLoteErr(r.error); return; }
              setLote(null); setFotoNum("1"); setClienteId("");
            }}
            className="rounded-lg bg-warning/25 px-3 py-1.5 text-xs font-medium text-warning transition hover:bg-warning/35 disabled:opacity-50"
          >
            Cerrar lote
          </button>
        )}
        {lote && (
          <>
            <input type="hidden" name="lote_id" value={lote.id} />
            <input type="hidden" name="lote_numero" value={String(lote.numero)} />
            <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Lote N° <strong className="font-mono text-foreground">{lote.numero}</strong> · {lote.fecha}
            </span>
            <label className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-muted-foreground">
              N° foto
              <input
                name="foto_numero"
                type="number"
                min="1"
                value={fotoNum}
                onChange={(e) => setFotoNum(e.target.value)}
                className="w-20 rounded border border-border bg-background px-2 py-1 text-xs text-foreground outline-none focus:border-primary"
              />
            </label>
          </>
        )}
        {!lote && (
          <span className="text-[11px] normal-case tracking-normal text-muted-foreground">
            Sin lote abierto: los cheques se cargan sueltos, sin numeración de foto.
          </span>
        )}
        {loteErr && <span className="text-[11px] normal-case tracking-normal text-danger">{loteErr}</span>}
      </div>
      <div className="flex gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={pendiente || conflicto}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary disabled:opacity-50"
        >
          {pendiente ? "Guardando…" : "Guardar cheque"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/90 transition hover:bg-muted"
        >
          Cerrar
        </button>
      </div>
    </form>
  );
}
