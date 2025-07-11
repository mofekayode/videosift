import { createClient } from '@supabase/supabase-js'

// Handle both client and server-side environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

if (!supabaseUrl) {
  throw new Error('Missing Supabase URL. Please check your environment variables.')
}

if (!supabaseAnonKey) {
  throw new Error('Missing Supabase anon key. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Only create the admin client if we have a service role key
// This allows the app to run in development without the service role key
export const supabaseAdmin = supabaseServiceKey 
  ? createClient(
      supabaseUrl,
      supabaseServiceKey,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    )
  : null; // Will be null in environments without the service role key