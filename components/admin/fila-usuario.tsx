"use client";

import { useState, useTransition } from "react";
import { cambiarRol, cambiarActivo } from "@/actions/usuarios";

export default function FilaUsuario({
  id,
  rol,
  activo,
  esYoMismo,
}: {
  id: string;
  rol: string;
  activo: boolean;
  esYoMismo: boolean;
}) {
  const [pendiente, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function ejecutar(fn: () => Promise<{ error: string | null }>) {
    setError(null);
    startTransition(async () => {
      const r = await fn();
      if (r.error) setError(r.error);
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={rol}
        disabled={pendiente || esYoMismo}
        onChange={(e) =>
          ejecutar(() =>
            cambiarRol({
              usuarioId: id,
              nuevoRol: e.target.value as "operador" | "administrador",
            })
          )
        }
        className="rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-xs text-zinc-100 disabled:opacity-50"
      >
        <option value="operador">Operador</option>
        <option value="administrador">Administrador</option>
      </select>

      <button
        disabled={pendiente || esYoMismo}
        onClick={() => ejecutar(() => cambiarActivo({ usuarioId: id, activo: !activo }))}
        className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
          activo
            ? "bg-red-900 text-red-200 hover:bg-red-800"
            : "bg-emerald-700 text-white hover:bg-emerald-600"
        }`}
      >
        {activo ? "Desactivar" : "Reactivar"}
      </button>

      {esYoMismo && <span className="text-xs text-zinc-500">(vos)</span>}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}
