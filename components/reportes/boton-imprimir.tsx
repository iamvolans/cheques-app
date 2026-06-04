"use client";

export default function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white print:hidden"
    >
      🖨 Imprimir / Guardar como PDF
    </button>
  );
}
