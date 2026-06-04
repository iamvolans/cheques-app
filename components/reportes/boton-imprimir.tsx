"use client";

import { Printer } from "lucide-react";

export default function BotonImprimir() {
  return (
    <button
      onClick={() => window.print()}
      className="inline-flex items-center gap-2 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-zinc-700 print:hidden"
    >
      <Printer size={15} />
      Imprimir / Guardar como PDF
    </button>
  );
}
