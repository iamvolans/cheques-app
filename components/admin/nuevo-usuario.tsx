"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { crearUsuario, type EstadoUsuario } from "@/actions/usuarios";

const inicial: EstadoUsuario = { error: null };

export default function NuevoUsuario() {
  const [abierto, setAbierto] = useState(false);
  const [estado, accion, pendiente] = useActionState(crearUsuario, inicial);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado.ok) {
      formRef.current?.reset();
      setAbierto(false);
    }
  }, [estado]);

  if (!abierto) {
    return (
      <button
        onClick={() => setAbierto(true)}
        className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary"
      >
        + Nuevo usuario
      </button>
    );
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/70 focus:border-primary focus:ring-2 focus:ring-primary/15";

  return (
    <form
      ref={formRef}
      action={accion}
      className="grid w-full gap-3 rounded-2xl border border-border bg-gradient-to-b from-card to-background p-5 shadow-lg shadow-foreground/5 sm:grid-cols-2"
    >
      <input name="nombre" placeholder="Nombre y apellido *" required className={inputCls} />
      <input name="email" type="email" placeholder="Email *" required className={inputCls} />
      <input name="password" type="text" placeholder="Contraseña temporal * (mín. 8)" required className={inputCls} />
      <select name="rol" defaultValue="operador" required className={inputCls}>
        <option value="operador">Operador</option>
        <option value="administrador">Administrador</option>
      </select>

      <p className="text-xs text-muted-foreground sm:col-span-2">
        Pasale la contraseña temporal por un canal seguro. En su primer ingreso,
        el sistema lo va a obligar a activar su propio MFA.
      </p>

      {estado.error && (
        <p className="rounded-lg border border-danger/40 bg-danger-muted px-3 py-2 text-sm text-danger sm:col-span-2">
          {estado.error}
        </p>
      )}

      <div className="flex gap-2 sm:col-span-2">
        <button
          type="submit"
          disabled={pendiente}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white shadow-md shadow-emerald-950/50 transition hover:bg-primary disabled:opacity-50"
        >
          {pendiente ? "Creando…" : "Crear usuario"}
        </button>
        <button
          type="button"
          onClick={() => setAbierto(false)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-foreground/90 transition hover:bg-muted"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
