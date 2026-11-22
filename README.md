<p align="center">
  <img src="public/logo512.png" width="96" alt="Star Vocab logo" />
</p>

<h1 align="center">Star Vocab · 就爱背单词</h1>

<p align="center">
  游戏化德语词汇训练：间隔重复 (FSRS / SM-2) + 物理引擎配对闯关，本地优先、可选云同步，另有离线桌面版。
</p>

<p align="center">
  <b><a href="https://vocab.mesaculpa.xyz">在线体验 · vocab.mesaculpa.xyz</a></b> · <a href="https://github.com/wenqiyuan0-netizen/star-vocab-game/releases">下载 Windows 版</a>
</p>

<p align="center">
  <a href="https://github.com/wenqiyuan0-netizen/star-vocab-game/actions/workflows/ci.yml"><img src="https://github.com/wenqiyuan0-netizen/star-vocab-game/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://github.com/wenqiyuan0-netizen/star-vocab-game/releases"><img src="https://img.shields.io/github/v/release/wenqiyuan0-netizen/star-vocab-game?label=desktop" alt="Release" /></a>
</p>

---

## 功能

| | |
|---|---|
| 🎮 **配对闯关** | Canvas + Matter.js 物理引擎，德语/中文词块漂浮碰撞，点击配对消除；连击、生命值、难度自适应 |
| 🧠 **间隔重复** | FSRS v4.5 轻量实现（可配置目标记忆保持率，保留 SM-2 兼容评分），每日新词/复习配额，积压复习的“清理模式” |
| 📚 **歌德 A1–B1 词库** | 一键导入 555 / 1310 / 2863 词预设，或粘贴自定义词表；3,000+ 词条附带歌德官方双语例句 |
| 🔎 **本地词典** | 2500 常用词释义、IPA、例句；离线词形还原（变位/变格 → 原形），IndexedDB 缓存 |
| 📰 **文章取词** | 粘贴德语短文，TextRank 关键词提取 + 可分动词识别（`fängt … an` → `anfangen`），纯本地计算 |
| ✨ **AI 造句（可选）** | 用户在浏览器内填入自己的 Gemini API Key，请求直连 Google，项目不托管任何 Key |
| 🎨 **壁纸主题** | 从壁纸提取色板并自动校正对比度（WCAG AA），磨砂玻璃 UI，亮/暗自适应 |
| 🔊 **音效与触感** | Web Audio 程序化音效（无音频文件）、按钮按压动效、移动端震动反馈，可调音量/静音 |
| ☁️ **云同步（可选）** | Supabase Auth + Postgres（RLS），时间戳 + 软删除墓碑的多端合并；不登录即游客模式 |
| 💻 **离线桌面版 / 安卓版** | Electron 打包的 Windows exe 与 Capacitor 打包的 Android APK，无账号、无网络依赖，数据保存在本机；iOS 可“添加到主屏幕” |
| 🌐 **三语界面** | 中文 / English / Deutsch 一键切换，自动识别浏览器语言 |

## 技术栈

React 19 · Tailwind CSS · Canvas / Matter.js · Web Audio API · IndexedDB · Supabase (Postgres + Auth + RLS) · Electron · Capacitor (Android) · GitHub Actions · GitHub Pages

## 架构要点

```
src/
├─ app/                     # 入口、全局触感反馈
├─ features/
│  ├─ game/                 # 配对闯关（Canvas 渲染循环 + Matter.js）
│  ├─ learning/             # SRS 调度、今日卡组生成、积压清理
│  ├─ vocabulary/           # 词库管理、导入解析、单词卡
│  ├─ profile/              # 设置、AI Key、音效
│  └─ auth/                 # 登录 / 游客模式
├─ shared/services/
│  ├─ dictionary/           # 本地词典 (IndexedDB) + 统一查询
│  ├─ ai/                   # TextRank 取词 + BYOK Gemini
│  └─ audio/                # 程序化音效 + 主音量总线
└─ infrastructure/          # Supabase 客户端（离线构建时为安全空实现）
```

- **本地优先**：所有学习进度先写 `localStorage`，登录后才与云端合并；云端不可用时自动降级为本地模式，不阻塞使用。
- **同一份代码两种产物**：`REACT_APP_OFFLINE=true` 构建时 Supabase 客户端被替换为可链式调用的空实现，桌面版无需任何分支代码。
- **桌面版用自定义协议**：Electron 通过 `app://bundle/` 提供构建产物（而非 `file://`），使 `fetch`、IndexedDB 与绝对路径资源行为与 Web 一致；窗口开启 sandbox、禁用 Node 集成、外链交给系统浏览器。

## 安全

- 仓库与构建产物中**不含任何私密 Key**；CI 会扫描构建产物。
- Supabase 只使用 anon/publishable key（设计上公开），所有表启用 **RLS**；调试用 RPC 已移除，触发器函数撤销了公开执行权限，函数固定 `search_path`（见 `supabase/migrations/20261122_security_hardening.sql`）。
- AI 功能采用 **Bring Your Own Key**：Key 仅存于用户浏览器，通过请求头直连 Google，不经过任何中转服务器。
- CSP 同时以 `<meta>` 标签内置于页面（静态托管无法设置响应头时依然生效）；Vercel 部署另配 HSTS、`nosniff` 等响应头（`vercel.json`）。

## 本地运行

需要 Node.js 22（见 `.nvmrc`）。

```bash
npm ci
npm start                 # http://localhost:3000 ，无需任何配置即可以游客模式运行
```

可选：复制 `.env.example` 为 `.env.local` 并填写 Supabase URL / anon key 以启用登录与云同步。

```bash
npm test                  # 单元测试
npm run lint              # ESLint
npm run build             # Web 构建
npm run electron:pack     # 构建离线版并打包 Windows 安装包 + 便携版 exe（输出到 dist/）
```

## 发布流程

- **CI**：每次 push / PR 运行 lint、单元测试、Web 与离线两种构建，并扫描构建产物中的密钥。
- **Web**：每次推送 `main`，GitHub Actions 构建并发布到 GitHub Pages（`vocab.mesaculpa.xyz`）；`vercel.json` 保留，也可部署到 Vercel。
- **桌面版 / 安卓版**：推送 `v*` 标签后，GitHub Actions 并行在 Windows runner 打包 exe、在 Ubuntu runner 用 Capacitor + Gradle 构建 APK，全部成功后统一发布到 Releases。

## 下载

在 [Releases](https://github.com/wenqiyuan0-netizen/star-vocab-game/releases) 下载：

- `StarVocab-Setup.exe`：Windows 安装版
- `StarVocab-Portable.exe`：Windows 便携版，免安装
- `StarVocab.apk`：Android 安装包（需允许“安装未知应用”）

> 安装包未做代码签名：Windows SmartScreen 可能提示“未知发布者”，选择“仍要运行”即可。iOS 需要付费开发者账号才能分发，因此提供 PWA：Safari →「分享 → 添加到主屏幕」。

---

开发笔记与历史设计文档见 [`docs/dev-notes`](docs/dev-notes)。
