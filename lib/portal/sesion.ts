import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(
  process.env.PORTAL_SESSION_SECRET ?? "CAMBIAR_ESTE_SECRETO_EN_ENV"
);
const DURACION_MIN = 30;

function nombreCookie(clienteId: string) {
  return `portal_ses_${clienteId.slice(0, 8)}`;
}

export async function crearSesionPortal(clienteId: string) {
  const token = await new SignJWT({ cid: clienteId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${DURACION_MIN}m`)
    .sign(SECRET);

  const jar = await cookies();
  jar.set(nombreCookie(clienteId), token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: DURACION_MIN * 60,
    path: "/portal",
  });
}

export async function tieneSesionPortal(clienteId: string): Promise<boolean> {
  const jar = await cookies();
  const token = jar.get(nombreCookie(clienteId))?.value;
  if (!token) return false;
  try {
    const { payload } = await jwtVerify(token, SECRET);
    return payload.cid === clienteId;
  } catch {
    return false;
  }
}

export async function cerrarSesionPortal(clienteId: string) {
  const jar = await cookies();
  jar.delete(nombreCookie(clienteId));
}
