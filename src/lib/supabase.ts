import { createClient } from '@supabase/supabase-js'

// Handle both client and server-side environment variables
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key'

if (!process.env.NEXT_PUBLIC_SUPABASE_URL && typeof window !== 'undefined') {
  console.error('Missing Supabase URL. Please check your environment variables.')
}

if (!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY && typeof window !== 'undefined') {
  console.error('Missing Supabase anon key. Please check your environment variables.')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Server-side client with service role key
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Create a lazy-loaded admin client to avoid errors during build
export const supabaseAdmin = (() => {
  let adminClient: ReturnType<typeof createClient> | null = null;
  
  return new Proxy({} as ReturnType<typeof createClient>, {
    get(target, prop) {
      if (!adminClient) {
        if (!supabaseServiceKey) {
          throw new Error(
            'Missing SUPABASE_SERVICE_ROLE_KEY environment variable. ' +
            'This is required for transcript storage. ' +
            'Please add it to your .env file and restart the Next.js dev server.'
          );
        }
        
        adminClient = createClient(
          supabaseUrl,
          supabaseServiceKey,
          {
            auth: {
              autoRefreshToken: false,
              persistSession: false,
            },
          }
        );
      }
      
      return adminClient[prop as keyof typeof adminClient];
    }
  });
})();