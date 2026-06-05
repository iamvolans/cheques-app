"use client";

import ZonaPeligro from "@/components/admin/zona-peligro";
import { eliminarCheque } from "@/actions/eliminar";

export default function EliminarCheque({ chequeId, numero }: { chequeId: string; numero: string }) {
  return (
    <ZonaPeligro
      titulo={`Eliminar cheque N° ${numero}`}
      descripcion="Solo para cargas erróneas que nunca impactaron en saldos. Requiere tu código de Google Authenticator. Las fotos se borran de Drive y queda registro permanente en auditoría."
      accion={(codigo) => eliminarCheque({ chequeId, codigo })}
      destinoTrasEliminar="/cheques"
    />
  );
}
