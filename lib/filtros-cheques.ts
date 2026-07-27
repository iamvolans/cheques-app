export type FiltrosCheques = {
  desde?: string;
  hasta?: string;
  cliente?: string;
  estado?: string;
  q?: string;
  tipoFecha?: string;
  convenio?: string;
  montoDesde?: string;
  montoHasta?: string;
  tipo?: string;
  plaza?: string;
  page?: string;
};

const COLS_FECHA: Record<string, string> = {
  carga: "fecha_carga",
  deposito: "fecha_deposito",
  acred: "fecha_estimada_acred",
  pago: "fecha_pago",
};

export function columnaFecha(tipoFecha?: string): string {
  return COLS_FECHA[tipoFecha ?? "pago"] ?? "fecha_pago";
}

export function textoBusqueda(q?: string): string {
  return (q ?? "").trim().replace(/[,()%]/g, "");
}

export function aplicarFiltros<T>(query: T, f: FiltrosCheques): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let x: any = query;
  const col = columnaFecha(f.tipoFecha);
  const tope = (h: string) => (col === "created_at" ? h + "T23:59:59" : h);

  if (f.desde) x = x.gte(col, f.desde);
  if (f.hasta) x = x.lte(col, tope(f.hasta));
  if (f.cliente) x = x.eq("cliente_id", f.cliente);
  if (f.convenio) x = x.eq("convenio_id", f.convenio);
  if (f.estado === "devuelto") {
    x = x.eq("estado", "rechazado").not("recibo_id", "is", null);
  } else if (f.estado === "rechazado_sin_entregar") {
    x = x.eq("estado", "rechazado").is("recibo_id", null);
  } else if (f.estado) {
    x = x.eq("estado", f.estado);
  }
  if (f.montoDesde && !isNaN(Number(f.montoDesde))) x = x.gte("monto", Number(f.montoDesde));
  if (f.montoHasta && !isNaN(Number(f.montoHasta))) x = x.lte("monto", Number(f.montoHasta));
  if (f.tipo === "echeq" || f.tipo === "fisico") x = x.eq("tipo", f.tipo);
  if (f.plaza === "camara" || f.plaza === "interior") x = x.eq("plaza", f.plaza);

  const t = textoBusqueda(f.q);
  if (t) {
    x = x.or(
      "numero_cheque.ilike.%" + t + "%,librador.ilike.%" + t +
        "%,cuit_librador.ilike.%" + t + "%,banco_emisor.ilike.%" + t + "%"
    );
  }
  return x as T;
}
