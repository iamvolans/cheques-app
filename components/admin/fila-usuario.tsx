"use client";

import { useState, useTransition } from "react";
import { cambiarRol, cambiarActivo } from "@/actions/usuarios";
import ResetPassword from "@/components/admin/reset-password";

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
        className="rounded border border-border bg-background px-2 py-1 text-xs text-foreground disabled:opacity-50"
      >
        <option value="operador">Operador</option>
        <option value="administrador">Administrador</option>
      </select>

      <button
        disabled={pendiente || esYoMismo}
        onClick={() => ejecutar(() => cambiarActivo({ usuarioId: id, activo: !activo }))}
        className={`rounded px-2 py-1 text-xs font-medium transition disabled:opacity-50 ${
          activo
            ? "bg-danger/20 text-danger hover:bg-danger/30"
            : "bg-primary text-white hover:bg-primary"
        }`}
      >
        {activo ? "Desactivar" : "Reactivar"}
      </button>

      {!esYoMismo && <ResetPassword userId={id} />}

      {esYoMismo && <span className="text-xs text-muted-foreground">(vos)</span>}
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
