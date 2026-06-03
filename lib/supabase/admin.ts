import { createClient as createSupabaseClient } from "@supabase/supabase-js";

// ⚠️ Cliente con la llave maestra (service_role): SALTEA TODA LA SEGURIDAD RLS.
// Solo se usa en el servidor para tareas de sistema (ej: enviar la cola de
// emails de rechazo). JAMÁS importar este archivo desde un componente
// con "use client".
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
