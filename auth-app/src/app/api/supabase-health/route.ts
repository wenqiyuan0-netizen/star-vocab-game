import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const searchUrl = req.nextUrl.searchParams.get('url') || undefined
  const providedKey = req.nextUrl.searchParams.get('key') || undefined
  const base = (searchUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || '').toString()
  const key = (providedKey || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').toString()
  if (!base) return NextResponse.json({ ok: false, error: 'Missing URL' }, { status: 400 })
  try {
    const res = await fetch(`${base.replace(/\/$/, '')}/auth/v1/health`, {
      cache: 'no-store',
      headers: key ? { apikey: key, Authorization: `Bearer ${key}` } : undefined
    })
    return NextResponse.json({ ok: res.ok, status: res.status })
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 })
  }
}
