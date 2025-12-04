import { createClient } from '@supabase/supabase-js'
import { mockSupabase } from './mockSupabase'

const readBrowserValue = (k: string) => {
  if (typeof window === 'undefined') return ''
  const v = window.localStorage.getItem(k)
  return v ? v : ''
}

export const getSupabase = () => {
  const browserUrl = readBrowserValue('sv_supabase_url')
  const browserKey = readBrowserValue('sv_supabase_anon_key')
  const url = (browserUrl || (process.env.NEXT_PUBLIC_SUPABASE_URL as string)) || ''
  const key = (browserKey || (process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string)) || ''
  const forceMock = (process.env.NEXT_PUBLIC_USE_SUPABASE_MOCK as string) === 'true'
  const useMock = forceMock || !url || !key
  if (useMock) return mockSupabase as any
  return createClient(url, key)
}

export const supabase = getSupabase()
