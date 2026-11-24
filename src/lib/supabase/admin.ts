import "server-only";

import { createClient } from "@supabase/supabase-js";

// Client avec la clé secrète : contourne la RLS. Réservé à la création des
// comptes employés, après vérification que l'appelant est l'admin.
export function adminConfigure() {
  return Boolean(process.env.SUPABASE_SECRET_KEY);
}

export function createAdminClient() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SECRET_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
