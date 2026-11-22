import { createClient } from '@supabase/supabase-js'
import { CLOUD_CONFIGURED } from '../shared/constants/config'

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
// The anon/publishable key is designed to be public; data is protected by RLS policies.
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

const OFFLINE_RESULT = { data: null, error: { message: 'cloud_disabled', code: 'OFFLINE' } }

// A chainable no-op query builder: any method call returns itself, and awaiting it
// resolves to an "offline" result. Lets cloud-aware code run unchanged in offline builds.
const offlineQuery = () => {
  const handler = {
    get(_t, prop) {
      if (prop === 'then') return (resolve) => resolve(OFFLINE_RESULT)
      return () => proxy
    }
  }
  const proxy = new Proxy({}, handler)
  return proxy
}

const offlineClient = {
  from: () => offlineQuery(),
  rpc: () => offlineQuery(),
  storage: { from: () => offlineQuery() },
  auth: {
    getSession: () => Promise.resolve({ data: { session: null }, error: null }),
    getUser: () => Promise.resolve({ data: { user: null }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => { } } } }),
    signInWithPassword: () => Promise.resolve(OFFLINE_RESULT),
    signUp: () => Promise.resolve(OFFLINE_RESULT),
    signOut: () => Promise.resolve({ error: null }),
  }
}

export const supabase = CLOUD_CONFIGURED
  ? createClient(supabaseUrl, supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : offlineClient
