"use client";

import ZonaPeligro from "@/components/admin/zona-peligro";
import { eliminarCheque } from "@/actions/eliminar";

const fmtARS = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS" });

export default function EliminarCheque({
  chequeId,
  numero,
  volver,
  impacto,
}: {
  chequeId: string;
  numero: string;
  volver?: string;
  impacto: number;
}) {
  const aviso = impacto === 0
    ? "Este cheque no generó movimientos: el saldo del cliente no cambia."
    : "ATENCIÓN: este cheque movió " + fmtARS.format(Math.abs(impacto)) +
      " en el saldo del cliente. Al eliminarlo ese movimiento se revierte.";
  return (
    <ZonaPeligro
      titulo={`Eliminar cheque N° ${numero}`}
      descripcion={aviso + " Requiere tu código de Google Authenticator. Las fotos se borran de Drive y queda registro permanente en auditoría."}
      accion={(codigo) => eliminarCheque({ chequeId, codigo })}
      destinoTrasEliminar={volver ?? "/cheques"}
    />
  );
}
