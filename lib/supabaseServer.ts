import 'server-only'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

// This client is for server-side operations only
// It uses the service role key which bypasses RLS
// NEVER expose this key to the client
if (!supabaseUrl || !supabaseServiceKey) {
  throw new Error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required for server operations')
}

const productionSupabaseRef = 'hjbneuicvfbihtbufrxq'
if (
  (process.env.VERCEL_ENV === 'preview' || process.env.VERCEL_ENV === 'development')
  && supabaseUrl.includes(productionSupabaseRef)
) {
  throw new Error('Preview and Vercel development cannot use the production Supabase project.')
}

export const supabaseServer = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  },
  db: {
    schema: 'public'
  },
  global: {
    headers: {
      'x-client-info': 'household-toolbox-server'
    }
  }
})

