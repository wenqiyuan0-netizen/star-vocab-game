'use client'
import { useState } from 'react'
import { getSupabase } from '@/lib/supabaseClient'
import { GlassButton } from '@/components/ui/GlassButton'
import { useTheme } from '@/hooks/useTheme'
import Link from 'next/link'

export default function RegisterPage() {
  const theme = useTheme()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [health, setHealth] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setMessage(null)
    setLoading(true)
    const { error: err } = await getSupabase().auth.signUp({
      email,
      password,
      options: { data: { name } }
    })
    setLoading(false)
    if (err) {
      setError(err.message)
      return
    }
    setMessage('注册成功，请前往邮箱完成验证')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: theme.gradients.surface }}>
      <div className="w-full max-w-sm rounded-3xl border p-6 glass-button" style={{ backgroundColor: theme.secondary + 'E6', borderColor: 'rgba(255,255,255,0.2)' }}>
        <div className="text-center mb-6">
          <h1 className="text-xl font-black" style={{ color: theme.text }}>注册</h1>
          <p className="text-xs font-bold opacity-60" style={{ color: theme.text }}>创建你的账号</p>
        </div>
        <form className="space-y-3" onSubmit={handleSubmit}>
          <input
            type="text"
            placeholder="昵称"
            value={name}
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2 rounded-xl bg-white text-slate-800 border focus:outline-none focus:ring-2"
            style={{ borderColor: `${theme.primary}40` }}
          />
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
          {message && (
            <div className="text-xs font-bold px-3 py-2 rounded-lg" style={{ backgroundColor: `${theme.primary}10`, color: theme.primary, border: `1px solid ${theme.primary}33` }}>
              {message}
            </div>
          )}
          <GlassButton variant="homePrimary" fullWidth disabled={loading} type="submit">
            {loading ? '注册中...' : '注册'}
          </GlassButton>
        </form>
        <div className="mt-3">
          <GlassButton
            variant="homeSecondary"
            fullWidth
            onClick={async () => {
              setHealth(null)
              try {
                const url = (window.localStorage.getItem('sv_supabase_url') || process.env.NEXT_PUBLIC_SUPABASE_URL || '').toString()
                const key = (window.localStorage.getItem('sv_supabase_anon_key') || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '').toString()
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
        </div>
        <div className="mt-4 text-center">
          <Link href="/auth/login" className="text-xs font-bold" style={{ color: theme.primary }}>
            已有账号？去登录
          </Link>
        </div>
      </div>
    </div>
  )
}
