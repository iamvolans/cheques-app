// Terminología oficial del sistema (etiquetas visibles).
// Los valores internos de la base NO cambian; solo lo que ve el usuario.
export const ETIQUETA_ESTADO: Record<string, string> = {
  en_custodia: "En custodia",
  aceptado: "En cartera",
  depositado: "En Clearing",
  procesado: "Acreditado",
  rechazado: "Rechazado",
};

export function etiquetaEstado(estado: string): string {
  return ETIQUETA_ESTADO[estado] ?? estado;
}

// Etiqueta derivada: un diferido cuya fecha ya llego se muestra "En cartera"
export function etiquetaEstadoConFecha(estado: string, fechaCobro?: string | null): string {
  if (estado === "en_custodia" && fechaCobro && fechaCobro <= new Date().toISOString().slice(0, 10)) {
    return "En cartera";
  }
  return etiquetaEstado(estado);
}
