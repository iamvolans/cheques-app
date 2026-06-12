"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, ReceiptText, Building2, Banknote,
  ShieldAlert, UserCog, Settings2, ScrollText, FileSpreadsheet, CalendarDays,
} from "lucide-react";

const operacion = [
  { href: "/dashboard", label: "Dashboard", Icon: LayoutDashboard },
  { href: "/cheques", label: "Cheques", Icon: ReceiptText },
  { href: "/clientes", label: "Clientes", Icon: Building2 },
  { href: "/liquidaciones", label: "Liquidaciones", Icon: Banknote },
  { href: "/custodias", label: "Custodias", Icon: CalendarDays },
  { href: "/libradores", label: "Riesgo · Libradores", Icon: ShieldAlert },
];

const administracion = [
  { href: "/admin/usuarios", label: "Usuarios", Icon: UserCog },
  { href: "/admin/reportes", label: "Reportes", Icon: FileSpreadsheet },
  { href: "/admin/configuracion", label: "Configuración", Icon: Settings2 },
  { href: "/admin/auditoria", label: "Auditoría", Icon: ScrollText },
];

function Item({ href, label, Icon }: (typeof operacion)[number]) {
  const pathname = usePathname();
  const activo = pathname === href || pathname.startsWith(href + "/");
  return (
    <Link
      href={href}
      className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition ${
        activo
          ? "bg-emerald-500/10 font-medium text-emerald-300"
          : "text-zinc-400 hover:bg-zinc-800/60 hover:text-zinc-100"
      }`}
    >
      <Icon size={17} className={activo ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300"} />
      {label}
      {activo && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400" />}
    </Link>
  );
}

export default function SidebarNav({ esAdmin }: { esAdmin: boolean }) {
  return (
    <nav className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      <div>
        <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
          Operación
        </p>
        <div className="space-y-0.5">
          {operacion.map((i) => <Item key={i.href} {...i} />)}
        </div>
      </div>
      {esAdmin && (
        <div>
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-zinc-600">
            Administración
          </p>
          <div className="space-y-0.5">
            {administracion.map((i) => <Item key={i.href} {...i} />)}
          </div>
        </div>
      )}
    </nav>
  );
}
