// 这是一个模拟的 Supabase 客户端，用于在无网络/无 Docker 环境下测试 UI 流程
// 它模仿了 supabase-js 的 API 结构

export const mockSupabase = {
  auth: {
    signInWithPassword: async ({ email, password }: any) => {
      console.log('[Mock] 正在尝试登录:', email)
      await new Promise(resolve => setTimeout(resolve, 800)) // 模拟网络延迟

      // 这里可以写死一些测试账号，或者默认都成功
      if (password === 'error') {
        return { data: null, error: { message: '模拟的密码错误 (输入 error 触发)' } }
      }

      return {
        data: {
          user: {
            id: 'mock-user-id-123',
            email: email,
            user_metadata: { name: 'Mock User' }
          },
          session: {
            access_token: 'mock-access-token',
            refresh_token: 'mock-refresh-token'
          }
        },
        error: null
      }
    },

    signUp: async ({ email, password, options }: any) => {
      console.log('[Mock] 正在尝试注册:', email, options)
      await new Promise(resolve => setTimeout(resolve, 800))

      if (email.includes('fail')) {
        return { data: null, error: { message: '模拟的注册失败 (邮箱含 fail 触发)' } }
      }

      return {
        data: {
          user: {
            id: 'mock-new-user-id',
            email: email,
            user_metadata: options?.data
          },
          session: null // 注册通常不直接返回 session (需验证邮箱)
        },
        error: null
      }
    },

    signOut: async () => {
      console.log('[Mock] 退出登录')
      return { error: null }
    },
    
    getSession: async () => {
       return { data: { session: null }, error: null }
    }
  }
} as any
