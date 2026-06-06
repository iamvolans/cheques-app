import { google } from "googleapis";

function clienteDrive() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: (process.env.GOOGLE_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

export async function descargarArchivoDrive(
  fileId: string
): Promise<{ buffer: Buffer; mime: string }> {
  const drive = clienteDrive();
  const meta = await drive.files.get({
    fileId,
    fields: "mimeType",
    supportsAllDrives: true,
  });
  const res = await drive.files.get(
    { fileId, alt: "media", supportsAllDrives: true },
    { responseType: "arraybuffer" }
  );
  return {
    buffer: Buffer.from(res.data as ArrayBuffer),
    mime: meta.data.mimeType ?? "application/octet-stream",
  };
}

export async function borrarArchivoDrive(fileId: string): Promise<void> {
  const drive = clienteDrive();
  await drive.files.delete({ fileId, supportsAllDrives: true });
}
