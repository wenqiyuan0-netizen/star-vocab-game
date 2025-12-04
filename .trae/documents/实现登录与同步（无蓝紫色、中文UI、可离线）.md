## 前提
- 后端最小鉴权代码已存在；前端仅需按约定接口集成。
- 保持中文 UI 与主题色卡；不使用固定蓝/紫。

## 接口约定（与后端对齐）
- `GET /api/auth/me` → { userId, email?, name? }（无则返回 401/空对象）
- `GET /api/auth/login/:provider` → 跳转到后端发起 OAuth（客户端只需 window.location.assign）
- `POST /api/auth/logout` → 清理 HttpOnly Cookie
- `GET /api/sync/profile` / `PUT /api/sync/profile` → { totalXP, level, updatedAt }
- `GET /api/sync/settings` / `PUT /api/sync/settings` → { json, updatedAt }
- `GET /api/sync/daily-stats` / `PUT /api/sync/daily-stats` → { json, updatedAt }
- `GET /api/sync/word-db` / `PUT /api/sync/word-db` → { json, updatedAt }
- 冲突字段：前端在 PUT 时携带 `lastKnownUpdatedAt`，后端做版本校验并返回合并结果

## 前端实现
- 新增 `AuthService`（仅前端封装）：
  - `getCurrentUser()`：请求 `/api/auth/me`
  - `login(provider)`：`window.location.assign('/api/auth/login/' + provider)`
  - `logout()`：`fetch('/api/auth/logout', { method:'POST' })`
  - `subscribeAuth()`：轮询或 SSE 监听登录态变化（可选）
- 新增 `SyncService`：统一读写 `/api/sync/*`，所有 PUT 带 `lastKnownUpdatedAt`
- 新增 `AuthGate`：根据 `getCurrentUser()` 显示“账号卡片”（登录/已登录）
- `ProfileView` 中新增“账号”板块与登录弹窗：
  - 登录按钮：提供 GitHub/Google/Apple（按后端支持）
  - 已登录态显示昵称/邮箱 + “登出”“立即同步”按钮
  - 颜色使用 `theme.*` 与 `glassStyle/getBrightestVariant`，无固定蓝/紫

## 数据命名空间
- 游客：`__guest` → 保留现有 localStorage（非敏感）
- 登录：读取云端并以 `userId` 覆盖本地命名空间；切换账号时重新加载与合并

## 同步策略
- 首次登录：本地 → 云（若云端为空）
- 后续登录/刷新：云 → 本地（时间戳比较）；发生冲突时提示用户选择，或采用“最近更新优先”

## 验收
- 无密钥/token 存在于前端；仅依赖后端 HttpOnly Cookie
- 弱网/离线下正常；恢复网络后增量同步
- UI 中文与主题色一致，动画沿用现有

## 需确认
- 后端实际提供的 provider 列表与具体路径名称（是否一致于上述约定）
- 是否提供 SSE（`/api/auth/events`）供前端实时感知登录态变更（可选）