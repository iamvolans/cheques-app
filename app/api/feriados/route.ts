import { NextResponse } from "next/server";
import { sincronizarFeriadosAnio } from "@/lib/feriados";

export async function GET(req: Request) {
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const anio = new Date().getFullYear();
  try {
    const a = await sincronizarFeriadosAnio(anio);
    const b = await sincronizarFeriadosAnio(anio + 1);
    return NextResponse.json({ [anio]: a, [anio + 1]: b });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
