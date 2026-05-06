import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Variáveis para guardar as instâncias em cache
let supabaseLocalInstance: SupabaseClient | null = null;
let supabaseSessionInstance: SupabaseClient | null = null;

export const getSupabaseClient = (rememberMe: boolean = true) => {
  if (typeof window === 'undefined') {
    // SSR (Server-Side)
    return createClient(supabaseUrl, supabaseAnonKey);
  }

  if (rememberMe) {
    // Retorna a instância em cache do localStorage se existir, senão cria uma
    if (!supabaseLocalInstance) {
      supabaseLocalInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: window.localStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    }
    return supabaseLocalInstance;
  } else {
    // Retorna a instância em cache do sessionStorage se existir, senão cria uma
    if (!supabaseSessionInstance) {
      supabaseSessionInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: window.sessionStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: true,
        },
      });
    }
    return supabaseSessionInstance;
  }
};

// Cliente padrão exportado
export const supabase = getSupabaseClient(true);