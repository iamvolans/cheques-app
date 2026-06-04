import { google } from "googleapis";
import { Readable } from "stream";

const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function getDrive() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_PRIVATE_KEY!.replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

// Busca una carpeta por nombre dentro de un padre; si no existe, la crea.
async function asegurarCarpeta(parentId: string, nombre: string): Promise<string> {
  const drive = getDrive();
  const nombreEscapado = nombre.replace(/'/g, "\\'");

  const { data } = await drive.files.list({
    q: `name = '${nombreEscapado}' and '${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
    fields: "files(id)",
    pageSize: 1,
    supportsAllDrives: true,
    includeItemsFromAllDrives: true,
  });

  if (data.files && data.files.length > 0) return data.files[0].id!;

  const { data: creada } = await drive.files.create({
    requestBody: {
      name: nombre,
      mimeType: "application/vnd.google-apps.folder",
      parents: [parentId],
    },
    fields: "id",
    supportsAllDrives: true,
  });
  return creada.id!;
}

// Devuelve el ID de la carpeta [Raíz]/[Cliente]/[Mes]/[dd-MM] del día de hoy.
export async function carpetaDelDia(nombreCliente: string): Promise<string> {
  const raiz = process.env.GOOGLE_DRIVE_ROOT_FOLDER_ID!;
  const hoy = new Date();
  const mes = MESES[hoy.getMonth()];
  const dia = `${String(hoy.getDate()).padStart(2, "0")}-${String(hoy.getMonth() + 1).padStart(2, "0")}`;

  const idCliente = await asegurarCarpeta(raiz, nombreCliente);
  const idMes = await asegurarCarpeta(idCliente, mes);
  return asegurarCarpeta(idMes, dia);
}

export async function subirArchivo(
  buffer: Buffer,
  nombre: string,
  mimeType: string,
  carpetaId: string
): Promise<{ id: string; url: string }> {
  const drive = getDrive();
  const { data } = await drive.files.create({
    requestBody: { name: nombre, parents: [carpetaId] },
    media: { mimeType, body: Readable.from(buffer) },
    fields: "id, webViewLink",
    supportsAllDrives: true,
  });
  return { id: data.id!, url: data.webViewLink! };
}

export async function borrarArchivo(id: string): Promise<void> {
  try {
    await getDrive().files.delete({ fileId: id, supportsAllDrives: true });
  } catch {
    // best effort: si falla el rollback no rompemos el flujo
  }
}
