// Etiquetas y estilos de los tipos de movimiento del cliente.
// Centralizado para que el portal, la ficha y cualquier otra vista coincidan.

export const ETIQUETA_MOV: Record<string, string> = {
  acreditacion: "Acreditación",
  debito_rechazo: "Débito por rechazo",
  liquidacion: "Liquidación",
  ajuste_manual: "Ajuste manual",
  reintegro_comision: "Reintegro de comisiones",
};

export const CLASE_MOV: Record<string, string> = {
  acreditacion: "bg-success-muted text-primary",
  debito_rechazo: "bg-danger-muted text-danger",
  liquidacion: "bg-info-muted text-info",
  ajuste_manual: "bg-muted text-foreground/90",
  reintegro_comision: "bg-success-muted text-primary",
};

export function etiquetaMov(tipo: string): string {
  return ETIQUETA_MOV[tipo] ?? tipo;
}

// En el portal, la acreditación por reintegro se muestra con concepto explícito
export function etiquetaMovPortal(tipo: string): string {
  if (tipo === "reintegro_comision") return "Acreditación por reintegro de comisiones";
  return ETIQUETA_MOV[tipo] ?? tipo;
}
