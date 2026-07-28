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
