"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const operacion = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/cheques", label: "Cheques" },
  { href: "/clientes", label: "Clientes" },
  { href: "/liquidaciones", label: "Liquidaciones" },
  { href: "/custodias", label: "Custodias" },
  { href: "/libradores", label: "Riesgo" },
];
const administracion = [
  { href: "/admin/usuarios", label: "Usuarios" },
  { href: "/admin/reportes", label: "Reportes" },
  { href: "/admin/configuracion", label: "Configuración" },
  { href: "/admin/auditoria", label: "Auditoría" },
];

export default function MobileNav({ esAdmin }: { esAdmin: boolean }) {
  const pathname = usePathname();
  const items = esAdmin ? [...operacion, ...administracion] : operacion;
  return (
    <nav className="flex gap-1.5 overflow-x-auto border-b border-zinc-800/70 bg-zinc-950 px-3 py-2 md:hidden">
      {items.map((i) => {
        const activo = pathname === i.href || pathname.startsWith(i.href + "/");
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium transition ${
              activo
                ? "bg-emerald-500/15 text-emerald-300"
                : "bg-zinc-900 text-zinc-400 hover:text-zinc-200"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
