import { createBrowserClient } from "@supabase/ssr";

// Cliente para componentes que corren en el navegador.
// Usa la clave pública (anon), por lo que toda operación pasa por RLS.
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
