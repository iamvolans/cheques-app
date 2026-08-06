// Toda fecha "de negocio" se resuelve en hora argentina, no en UTC.
// Los timestamps completos (updated_at, fecha_resolucion) siguen siendo instantes
// absolutos y no pasan por aca: solo se corrige el colapso a fecha.
const TZ = "America/Argentina/Buenos_Aires";

const fmt = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function fechaART(d: Date = new Date()): string {
  return fmt.format(d);
}

export function hoyART(): string {
  return fechaART();
}

export function mesART(): string {
  return hoyART().slice(0, 7);
}

// Los timestamps se renderizan en el servidor, que corre en UTC.
// Sin forzar la zona, la auditoria muestra tres horas menos y de noche cambia de dia.
const fmtDT = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit", month: "2-digit", year: "numeric",
  hour: "2-digit", minute: "2-digit", second: "2-digit",
  hour12: false,
});

const fmtD = new Intl.DateTimeFormat("es-AR", {
  timeZone: TZ,
  day: "2-digit", month: "2-digit", year: "numeric",
});

// Una fecha suelta "2026-08-05" se parsea como medianoche UTC y en Argentina
// cae el dia anterior: la llevamos al mediodia para que no se corra.
function aDate(v?: string | Date | null): Date {
  if (!v) return new Date();
  if (v instanceof Date) return v;
  return new Date(/^\d{4}-\d{2}-\d{2}$/.test(v) ? v + "T12:00:00" : v);
}

export function fechaHoraART(v?: string | Date | null): string {
  return fmtDT.format(aDate(v));
}

export function fechaCortaART(v?: string | Date | null): string {
  return fmtD.format(aDate(v));
}
