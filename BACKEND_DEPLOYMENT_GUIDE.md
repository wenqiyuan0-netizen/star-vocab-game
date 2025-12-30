# 后端部署指南 (Backend Deployment Guide)

## 问题诊断

当前问题：Vercel部署的是前端React应用，AI功能需要的Next.js后端API没有部署。

## 解决方案：部署auth-app到Vercel

### 方法1：使用Vercel CLI（推荐）

1. **安装Vercel CLI**：
   ```bash
   npm install -g vercel
   ```

2. **登录Vercel**：
   ```bash
   vercel login
   ```

3. **部署auth-app**：
   ```bash
   cd auth-app
   vercel
   ```

4. **按照提示操作**：
   - Set up and deploy? **Yes**
   - Which scope? 选择你的团队/个人账户
   - Link to existing project? **No** (创建新项目)
   - Project name? **star-vocab-backend** (或其他名称)
   - In which directory is your code located? **./  (当前目录)**
   - Want to override settings? **No**

5. **部署成功后，记录生产URL**（如 https://star-vocab-backend.vercel.app）

6. **配置环境变量**：
   在Vercel Dashboard中为该项目添加环境变量：
   - `GEMINI_API_KEY`: 你的Gemini API密钥
   - `NEXT_PUBLIC_SUPABASE_URL`: Supabase URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Supabase匿名密钥
   - `SUPABASE_SERVICE_ROLE_KEY`: Supabase服务角色密钥
   - `NEXT_PUBLIC_APP_URL`: `http://localhost:3001` (开发环境)
   - `NEXT_PUBLIC_ALLOWED_ORIGINS`: `http://localhost:3001,http://localhost:3000`

### 方法2：使用Vercel Dashboard

1. 访问 https://vercel.com/dashboard
2. 点击 **Add New** → **Project**
3. 导入你的GitHub仓库
4. **Root Directory**: 设置为 `auth-app`
5. **Framework Preset**: 选择 **Next.js**
6. 点击 **Deploy**

### 部署后配置前端

部署成功后，更新前端配置指向新的后端URL：

1. 创建或修改 `.env.local` 文件：
   ```bash
   REACT_APP_BACKEND_URL=https://你的后端URL.vercel.app
   ```

2. 或者在localStorage中设置（开发测试）：
   ```javascript
   localStorage.setItem('star-vocab-backend', 'https://你的后端URL.vercel.app')
   ```

## 验证部署

部署成功后，测试API是否可用：

```bash
curl https://你的后端URL.vercel.app/api/gemini-proxy \
  -X POST \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -d '{"prompt":"测试"}'
```

应该返回401（需要真实token）或403（需要等级10），而不是404。

## 常见问题

### Q: 仍然返回404？
A: 检查Vercel项目的Root Directory是否正确设置为 `auth-app`

### Q: CORS错误？
A: 确保环境变量 `NEXT_PUBLIC_ALLOWED_ORIGINS` 包含你的前端URL

### Q: Gemini API错误？
A: 检查 `GEMINI_API_KEY` 环境变量是否正确配置
