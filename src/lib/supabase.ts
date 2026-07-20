import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "[Supabase] Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY. " +
      "Database features will not work. " +
      "Set these in your .env file."
  );
}

/**
 * Supabase client instance.
 *
 * Uses un-typed createClient for now to avoid strict generic mismatches
 * during rapid prototyping.  Once the schema stabilises, run
 * `npx supabase gen types typescript` to generate exact types and pass
 * them as the generic parameter.
 */
export const supabase = createClient(
  supabaseUrl ?? "https://placeholder.supabase.co",
  supabaseAnonKey ?? "placeholder-key"
);
