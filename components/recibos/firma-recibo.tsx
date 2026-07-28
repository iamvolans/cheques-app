"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { firmarRecibo } from "@/actions/recibos";

export default function FirmaRecibo({ reciboId }: { reciboId: string }) {
  const lienzo = useRef<HTMLCanvasElement>(null);
  const trazando = useRef(false);
  const [hayTrazo, setHayTrazo] = useState(false);
  const [aclaracion, setAclaracion] = useState("");
  const [dni, setDni] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();
  const router = useRouter();

  useEffect(() => {
    const c = lienzo.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = c.clientWidth * dpr;
    c.height = c.clientHeight * dpr;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.scale(dpr, dpr);
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111111";
  }, []);

  const punto = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = lienzo.current;
    if (!c) return { x: 0, y: 0 };
    const r = c.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  const empezar = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = lienzo.current?.getContext("2d");
    if (!ctx) return;
    lienzo.current?.setPointerCapture(e.pointerId);
    trazando.current = true;
    setHayTrazo(true);
    const p = punto(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
  };

  const mover = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!trazando.current) return;
    const ctx = lienzo.current?.getContext("2d");
    if (!ctx) return;
    const p = punto(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
  };

  const soltar = () => { trazando.current = false; };

  const borrar = () => {
    const c = lienzo.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    setHayTrazo(false);
  };

  const dniLimpio = dni.replace(/\D/g, "");
  const listo = hayTrazo && aclaracion.trim().length >= 3 && dniLimpio.length >= 7 && dniLimpio.length <= 8;

  const confirmar = () => {
    const c = lienzo.current;
    if (!c) return;
    setErr(null);
    const png = c.toDataURL("image/png");
    startTransition(async () => {
      const r = await firmarRecibo({ reciboId, png, aclaracion, dni });
      if (r.error) { setErr(r.error); return; }
      router.refresh();
    });
  };

  const inp = "w-full rounded border border-neutral-400 bg-white px-2 py-1.5 text-sm text-black outline-none focus:border-black";

  return (
    <div className="space-y-3 rounded border border-neutral-400 p-4 print:hidden">
      <p className="text-sm font-semibold">Firma de quien recibe</p>
      <canvas
        ref={lienzo}
        onPointerDown={empezar}
        onPointerMove={mover}
        onPointerUp={soltar}
        onPointerLeave={soltar}
        onPointerCancel={soltar}
        className="h-40 w-full cursor-crosshair rounded border border-dashed border-neutral-500 bg-white"
        style={{ touchAction: "none" }}
      />
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={borrar} className="rounded border border-neutral-400 px-3 py-1 text-xs text-neutral-700">
          Borrar y volver a firmar
        </button>
        <span className="text-xs text-neutral-500">Firmá con el dedo, el mouse o un lápiz óptico.</span>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="text-xs text-neutral-600">
          Aclaración *
          <input value={aclaracion} onChange={(e) => setAclaracion(e.target.value)} placeholder="Nombre y apellido" className={inp} />
        </label>
        <label className="text-xs text-neutral-600">
          DNI *
          <input value={dni} onChange={(e) => setDni(e.target.value)} inputMode="numeric" placeholder="12345678" className={inp} />
        </label>
      </div>
      {err && <p className="rounded border border-red-400 bg-red-50 px-2 py-1 text-xs text-red-700">{err}</p>}
      <button
        type="button"
        disabled={!listo || pendiente}
        onClick={confirmar}
        className="rounded bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-40"
      >
        {pendiente ? "Registrando firma…" : "Confirmar recepción y firmar"}
      </button>
      <p className="text-[11px] leading-snug text-neutral-500">
        Al firmar se registran fecha, hora y una huella digital del contenido. Los cheques
        del recibo quedan bloqueados para edición.
      </p>
    </div>
  );
}
