"use client";

import ZonaPeligro from "@/components/admin/zona-peligro";
import { eliminarCliente } from "@/actions/eliminar";

export default function EliminarCliente({ clienteId, nombre }: { clienteId: string; nombre: string }) {
  return (
    <ZonaPeligro
      titulo={`Eliminar cliente ${nombre}`}
      descripcion="Solo para cuentas creadas por error, sin cheques ni movimientos. Requiere tu código de Google Authenticator. Queda registro permanente en auditoría."
      accion={(codigo) => eliminarCliente({ clienteId, codigo })}
      destinoTrasEliminar="/clientes"
    />
  );
}
