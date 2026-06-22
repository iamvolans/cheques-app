"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import Link from "next/link";
import { Bell } from "lucide-react";
import { listarNotificaciones, marcarTodasLeidas, type NotifRow } from "@/actions/notificaciones-ui";

export default function Campana() {
  const [items, setItems] = useState<NotifRow[]>([]);
  const [abierto, setAbierto] = useState(false);

  const noLeidas = items.filter((n) => !n.leida).length;

  useEffect(() => {
    listarNotificaciones().then((r) => setItems(r.items));

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const canal = supabase
      .channel("notificaciones-ui")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notificaciones" },
        (payload) => {
          setItems((prev) => [payload.new as NotifRow, ...prev].slice(0, 30));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(canal);
    };
  }, []);

  async function alternar() {
    const nuevoEstado = !abierto;
    setAbierto(nuevoEstado);
    if (nuevoEstado && noLeidas > 0) {
      await marcarTodasLeidas();
      setItems((prev) => prev.map((n) => ({ ...n, leida: true })));
    }
  }

  return (
    <div className="relative">
      <button
        onClick={alternar}
        title="Notificaciones"
        className="relative flex h-8 w-8 items-center justify-center rounded-full border border-border text-muted-foreground transition hover:text-foreground"
      >
        <Bell size={16} />
        {noLeidas > 0 && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
            {noLeidas}
          </span>
        )}
      </button>

      {abierto && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setAbierto(false)} />
          <div className="absolute right-0 top-10 z-30 w-80 overflow-hidden rounded-xl border border-border bg-card shadow-xl shadow-black/40">
            <p className="border-b border-border px-4 py-2.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Notificaciones
            </p>
            <div className="max-h-96 divide-y divide-border overflow-y-auto">
              {items.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-foreground0">Sin novedades.</p>
              )}
              {items.map((n) => (
                <Link
                  key={n.id}
                  href={n.link ?? "#"}
                  onClick={() => setAbierto(false)}
                  className="block px-4 py-3 transition hover:bg-muted/40"
                >
                  <p className="text-sm text-foreground">{n.titulo}</p>
                  {n.detalle && <p className="text-xs text-muted-foreground">{n.detalle}</p>}
                  <p className="mt-0.5 text-[10px] text-muted-foreground/70">
                    {new Date(n.created_at).toLocaleString("es-AR")}
                  </p>
                </Link>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
