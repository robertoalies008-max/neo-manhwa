import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured = Boolean(
  supabaseUrl && 
  supabaseAnonKey && 
  !supabaseUrl.includes('your-project-id') &&
  !supabaseAnonKey.includes('your-anon-public-key')
);

if (!isSupabaseConfigured) {
  console.info(
    'ℹ️ [Supabase] VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY not set in frontend/.env. The app is running in offline/mock mode until credentials are provided.'
  );
}

// Fallback dummy URL so createClient does not throw on empty string during initialization
const validUrl = isSupabaseConfigured ? supabaseUrl : 'https://placeholder-domain.supabase.co';
const validKey = isSupabaseConfigured ? supabaseAnonKey : 'placeholder-anon-key';

export const supabase = createClient(validUrl, validKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
