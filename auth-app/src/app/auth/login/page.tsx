'use client'
import { useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { GlassButton } from '@/components/ui/GlassButton'
import { useTheme } from '@/hooks/useTheme'
import Link from 'next/link'

export default function LoginPage() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<string | null>(null)
  const [supabaseUrl, setSupabaseUrl] = useState('')
  const [supabaseKey, setSupabaseKey] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: err } = await getSupabase().auth.signInWithPassword({ email, password })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || '/'
    const userEmail = email.split('@')[0]
    window.location.href = `${appUrl}?user=${encodeURIComponent(userEmail)}&status=online`
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: theme.gradients.surface }}>
      <div className="w-full max-w-sm rounded-3xl border p-6 glass-button" style={{ backgroundColor: theme.secondary + 'E6', borderColor: 'rgba(255,255,255,0.2)' }}>
        <div className="text-center mb-6">
          <h1 className="text-xl font-black" style={{ color: theme.text }}>登录</h1>
          <p className="text-xs font-bold opacity-60" style={{ color: theme.text }}>输入邮箱与密码</p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            type="email"
            placeholder="邮箱"
            value={email}
            onChange={e => setEmail(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-white text-slate-800 border focus:outline-none focus:ring-2"
            style={{ borderColor: `${theme.primary}40` }}
            required
          />
          <input
            type="password"
            placeholder="密码"
            value={password}
            onChange={e => setPassword(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-white text-slate-800 border focus:outline-none focus:ring-2"
            style={{ borderColor: `${theme.primary}40` }}
            required
          />
          {error && (
            <div className="text-xs font-bold px-3 py-2 rounded-lg" style={{ backgroundColor: `${theme.accent}10`, color: theme.accent, border: `1px solid ${theme.accent}33` }}>
              {error}
            </div>
          )}
          <GlassButton variant="homePrimary" fullWidth disabled={loading} type="submit">
            {loading ? '登录中...' : '登录'}
          </GlassButton>
        </form>
        <div className="mt-3">
          <GlassButton
            variant="homeSecondary"
            fullWidth
            onClick={async () => {
              setHealth(null)
              try {
                const url = (supabaseUrl || window.localStorage.getItem('sv_supabase_url') || process.env.NEXT_PUBLIC_SUPABASE_URL || '').toString()
                const key = (supabaseKey || window.localStorage.getItem('sv_supabase_anon_key') || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').toString()
                const q = new URLSearchParams({ url, key }).toString()
                const res = await fetch(`/api/supabase-health?${q}`, { cache: 'no-store' })
                const data = await res.json()
                if (data.ok) setHealth('Supabase 可达')
                else setHealth(`连接失败 (${data.status ?? data.error ?? '未知错误'})`)
              } catch {
                setHealth('连接失败 (网络错误)')
              }
            }}
          >
            测试连接
          </GlassButton>
          {health && (
            <div className="mt-2 text-center text-xs font-bold" style={{ color: health === 'Supabase 可达' ? theme.primary : theme.accent }}>
              {health}
            </div>
          )}
          <div className="mt-4 grid grid-cols-1 gap-2">
            <input
              type="text"
              placeholder="Supabase URL"
              value={supabaseUrl}
              onChange={e => setSupabaseUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white text-slate-800 border focus:outline-none focus:ring-2"
              style={{ borderColor: `${theme.primary}40` }}
            />
            <input
              type="text"
              placeholder="Supabase anon key"
              value={supabaseKey}
              onChange={e => setSupabaseKey(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-white text-slate-800 border focus:outline-none focus:ring-2"
              style={{ borderColor: `${theme.primary}40` }}
            />
            <GlassButton
              variant="homePrimary"
              fullWidth
              onClick={() => {
                try {
                  window.localStorage.setItem('sv_supabase_url', supabaseUrl.trim())
                  window.localStorage.setItem('sv_supabase_anon_key', supabaseKey.trim())
                  setHealth('已保存配置，请刷新页面生效')
                } catch {}
              }}
            >
              保存配置
            </GlassButton>
          </div>
        </div>
        <div className="mt-4 text-center">
          <Link href="/auth/register" className="text-xs font-bold" style={{ color: theme.primary }}>
            没有账号？前往注册
          </Link>
        </div>
      </div>
    </div>
  )
}
