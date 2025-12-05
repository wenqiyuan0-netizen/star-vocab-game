import { NextRequest } from 'next/server'
import { createSupabaseClient } from '@/lib/supabaseServer'

const getCorsHeaders = (req: NextRequest) => {
  const origin = req.headers.get('origin') || ''
  
  // Define allowed origins
  const isLocalhost = origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')
  const isVercel = origin.endsWith('.vercel.app')
  const isCustomDomain = process.env.NEXT_PUBLIC_APP_URL ? origin === process.env.NEXT_PUBLIC_APP_URL : false
  
  const isAllowed = isLocalhost || isVercel || isCustomDomain

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'null',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }
}

export async function OPTIONS(req: NextRequest) {
  return new Response(null, { status: 204, headers: getCorsHeaders(req) })
}

export async function POST(req: NextRequest) {
  const corsHeaders = getCorsHeaders(req)
  
  // 1. Extract Authorization Header
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'unauthorized_missing_header' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  const token = authHeader.replace('Bearer ', '')
  
  // 2. Verify Token with Supabase
  const supabase = createSupabaseClient(token)
  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
     return new Response(JSON.stringify({ error: 'unauthorized_invalid_token' }), {
      status: 401,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  // 3. Check User Level (Feature Unlock)
  // Query the 'profiles' table to get the user's level
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('level')
    .eq('id', user.id)
    .single()

  // Default requirement: Level 5 to unlock AI
  const REQUIRED_LEVEL = 10
  const currentLevel = profile?.level || 0

  if (currentLevel < REQUIRED_LEVEL) {
    return new Response(JSON.stringify({ 
      error: 'feature_locked', 
      message: `AI feature requires Level ${REQUIRED_LEVEL}. You are Level ${currentLevel}.` 
    }), {
      status: 403,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }

  try {
    const { prompt, model, apiKey: clientKey } = await req.json()
    const apiKey = clientKey || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'missing_api_key' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }
    const m = model || 'gemini-2.5-flash-preview-09-2025'
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${m}:generateContent?key=${apiKey}`
    const upstream = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    })
    const body = await upstream.text()
    return new Response(body, {
      status: upstream.status,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  } catch {
    return new Response(JSON.stringify({ error: 'proxy_error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
}

