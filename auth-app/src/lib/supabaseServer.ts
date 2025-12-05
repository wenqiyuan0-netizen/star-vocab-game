import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
// 注意：在后端API路由中，我们通常使用service_role key来绕过RLS，
// 但这里我们只需要验证用户的JWT token，所以创建一个普通的client即可。
// 如果需要查询用户的profile数据（受RLS保护），我们需要将用户的token传递给supabase client。

export const createSupabaseClient = (accessToken: string) => {
  return createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}
