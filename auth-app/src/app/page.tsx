"use client"
import Link from "next/link";
import { GlassButton } from "@/components/ui/GlassButton";
import { useTheme } from "@/hooks/useTheme";

export default function Home() {
  const theme = useTheme()
  return (
    <div className="min-h-screen flex items-center justify-center p-6" style={{ background: theme.gradients.surface }}>
      <div className="w-full max-w-sm glass-button rounded-3xl p-6 border" style={{ backgroundColor: theme.secondary + 'E6', borderColor: 'rgba(255,255,255,0.2)' }}>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black" style={{ color: theme.text }}>Star Vocab Auth</h1>
          <p className="text-xs font-bold opacity-60" style={{ color: theme.text }}>使用 Supabase 注册与登录</p>
        </div>
        <div className="space-y-3">
          <Link href="/auth/login" className="block">
            <GlassButton variant="homePrimary" fullWidth>
              账号登录
            </GlassButton>
          </Link>
          <Link href="/auth/register" className="block">
            <GlassButton variant="homeSecondary" fullWidth>
              新用户注册
            </GlassButton>
          </Link>
        </div>
      </div>
    </div>
  )
}
