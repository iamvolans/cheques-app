"use client";

import { useActionState } from "react";
import { login, type EstadoLogin } from "@/actions/auth";

const estadoInicial: EstadoLogin = { error: null };

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState(login, estadoInicial);

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-50">
            Gestión de Cobranza
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Cheques físicos y E-Cheqs
          </p>
        </div>

        <form
          action={accion}
          className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6"
        >
          <div>
            <label
              htmlFor="email"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
              placeholder="usuario@empresa.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm font-medium text-zinc-300"
            >
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-emerald-500"
              placeholder="••••••••"
            />
          </div>

          {estado.error && (
            <p className="rounded-lg border border-red-900 bg-red-950 px-3 py-2 text-sm text-red-300">
              {estado.error}
            </p>
          )}

          <button
            type="submit"
            disabled={pendiente}
            className="w-full rounded-lg bg-emerald-600 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 disabled:opacity-50"
          >
            {pendiente ? "Ingresando..." : "Ingresar"}
          </button>
        </form>
      </div>
    </main>
  );
}
