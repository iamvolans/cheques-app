import { createAdminClient } from "@/lib/supabase/admin";

type Feriado = { fecha: string; descripcion: string };

async function deArgentinaDatos(anio: number): Promise<Feriado[]> {
  const r = await fetch(`https://api.argentinadatos.com/v1/feriados/${anio}`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("argentinadatos respondió " + r.status);
  const data = (await r.json()) as Array<{ fecha?: string; nombre?: string }>;
  return data
    .filter((f) => !!f.fecha)
    .map((f) => ({ fecha: f.fecha as string, descripcion: f.nombre ?? "Feriado" }));
}

async function deNager(anio: number): Promise<Feriado[]> {
  const r = await fetch(`https://date.nager.at/api/v3/PublicHolidays/${anio}/AR`, {
    cache: "no-store",
  });
  if (!r.ok) throw new Error("nager respondió " + r.status);
  const data = (await r.json()) as Array<{ date?: string; localName?: string; name?: string }>;
  return data
    .filter((f) => !!f.date)
    .map((f) => ({ fecha: f.date as string, descripcion: f.localName ?? f.name ?? "Feriado" }));
}

// Trae los feriados de un año (API principal con fallback) y los upserta.
export async function sincronizarFeriadosAnio(anio: number): Promise<number> {
  let feriados: Feriado[];
  try {
    feriados = await deArgentinaDatos(anio);
  } catch {
    feriados = await deNager(anio);
  }

  // Los bancos cierran el Día del Bancario aunque no sea feriado nacional.
  if (!feriados.some((f) => f.fecha === `${anio}-11-06`)) {
    feriados.push({ fecha: `${anio}-11-06`, descripcion: "Día del Bancario (bancos cerrados)" });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("feriados")
    .upsert(feriados, { onConflict: "fecha" });
  if (error) throw new Error(error.message);
  return feriados.length;
}
