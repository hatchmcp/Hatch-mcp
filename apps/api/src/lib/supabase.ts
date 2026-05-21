import { createClient } from '@supabase/supabase-js'
import { config } from '../config.js'

// Admin client — bypasses RLS, used server-side only
export const supabaseAdmin = createClient(
  config.SUPABASE_URL,
  config.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Verify a Supabase JWT from the Authorization header and return the user.
// Returns null if the token is invalid or expired.
export async function verifyToken(token: string) {
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}
