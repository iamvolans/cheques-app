import pkg from "../../package.json";

export default function Logo() {
  return (
    <div className="flex items-center gap-2.5 border-b border-border px-3 pb-4">
      <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0" aria-label="GC">
        <rect width="64" height="64" rx="14" fill="#123524" />
        <text x="32" y="43" fontFamily="Arial, Helvetica, sans-serif" fontSize="27" fontWeight="bold" fill="#7ee2a8" textAnchor="middle" letterSpacing="1">GC</text>
        <rect x="17" y="49" width="30" height="2.5" rx="1.25" fill="#2e8b57" />
      </svg>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold leading-tight text-foreground">Gestión de Cobranza</p>
        <p className="text-[10px] font-mono text-muted-foreground">v{pkg.version}</p>
      </div>
    </div>
  );
}
