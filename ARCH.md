# 技术架构文档：Star Vocab Game

## 1. 系统概述

Star Vocab Game 是一个基于 React 的纯前端单页应用 (SPA)。它采用了独特的 **混合渲染架构**：核心游戏逻辑与画面由高性能 HTML5 Canvas 驱动，而 UI 界面则采用 React + Tailwind CSS 构建的现代 Glassmorphism（磨砂玻璃）设计系统。

## 2. 架构图

```mermaid
graph TD
    User[用户] -->|交互| UI[React UI 层 (Glassmorphism)]
    User -->|游戏操作| GameLoop[游戏循环 (Canvas)]
    
    subgraph "表现层 (Presentation)"
        UI -->|主题/壁纸| ThemeContext[Theme Context]
        UI -->|导航/设置| App[App 组件]
        GameLoop -->|物理/渲染| Canvas[HTML5 Canvas]
        App --> SpaceVocabGame
    end

    subgraph "UI 设计系统 (Glassmorphism)"
        ThemeContext -->|提供| GlassPanel[Glass Panel]
        ThemeContext -->|提供| GlassButton[Glass Button]
        ThemeContext -->|提供| WallpaperSettings[壁纸编辑器]
        ThemeContext -->|提供| ColorTransition[色彩平滑过渡]
    end

    subgraph "核心逻辑 (Logic Core)"
        SpaceVocabGame -->|管理| State[游戏状态]
        SpaceVocabGame -->|调用| Spawner[生成器 (Spawner)]
        SpaceVocabGame -->|调用| SRS[记忆算法 (SRS)]
    end

    subgraph "服务层 (Services)"
        SpaceVocabGame -->|调用| AIService[AI 服务 (Gemini)]
        SpaceVocabGame -->|调用| SoundManager[音效管理器]
        SpaceVocabGame -->|调用| Persistence[持久化管理器]
    end

    subgraph "数据存储"
        Persistence -->|读/写| LocalStorage[(浏览器本地存储)]
    end

    AIService -->|HTTP 请求| GeminiAPI[Google Gemini API]
```

## 3. 核心模块详解

### 3.1. 游戏引擎 (`SpaceVocabGame.js`)
应用的中央控制器。
- **职责**:
  - 管理全局游戏状态（分数、生命值、游戏模式）。
  - 维护基于 `requestAnimationFrame` 的主游戏循环。
  - **物理碰撞系统**：实现刚体碰撞、弹性反弹及速度计算（纯 JS 逻辑，无第三方物理引擎）。
  - 协调 React UI 层（HUD、弹窗）与 Canvas 渲染层的数据同步。

### 3.2. UI 设计系统 (`App.css` & Components)
基于 Glassmorphism 的现代 UI 架构，重点优化了性能与视觉稳定性。
- **核心类 (`App.css`)**:
  - `.glass-panel`: 高斯模糊背景 (`backdrop-filter: blur(...)`)，适配深色/浅色壁纸。
  - `.glass-button`: 交互式磨砂按钮，支持悬停光晕与按压反馈。
- **性能优化策略**:
  - **动态模糊分级**: 根据设备性能（桌面/移动）动态调整模糊半径，移动端使用更低的模糊值以保证帧率。
  - **动画状态管理**: 在界面切换动画期间启用/禁用特定的模糊效果，并在动画结束后移除高开销的 `backdrop-filter`，防止渲染管线重置导致的屏幕闪烁。
  - **硬件加速**: 使用 `will-change` 提示浏览器提前为玻璃层分配图层。
- **壁纸系统 (`WallpaperSettings.js`)**:
  - 支持用户上传图片。
  - 前端实时图像处理：Canvas 滤镜、缩放、裁剪。
  - 自动提取图片主色调 (`colorUtils.js`) 并应用为全局主题色。

### 3.3. 逻辑层 (`src/logic/`)
业务逻辑与 UI 分离，确保代码的可维护性。

- **`srs.js` (间隔重复系统)**:
  - 实现类似 SM-2 的记忆算法。
  - 根据用户的回答质量计算 `easeFactor`（简易度）、`interval`（复习间隔）和下一次 `dueDate`（复习日期）。
  
- **`AIService.js`**:
  - 封装与 Google Gemini API 的通信。
  - 提供 `generateExample` 方法生成例句。
  - 处理 API 错误重试与降级逻辑。
  - 管理 `window.speechSynthesis` 进行语音朗读。

- **`spawner.js`**:
  - 控制“单词陨石”的生成逻辑。
  - 优先级队列管理：优先生成“到期”需要复习的单词，其次是新词。

- **`visualEntities.js`**:
  - 定义游戏视觉实体类，如 `Particle`（粒子效果）和 `StarFragment`。
  - 包含实体的物理运动与渲染逻辑。

- **`persistence.js`**:
  - 处理数据的序列化与反序列化。
  - 实现存档的 Base64 压缩与解压。
  - 封装 `localStorage` 的读写操作。

### 3.4. 渲染系统
- **混合渲染架构**:
  - **Canvas 层**: 用于渲染高频更新的游戏元素（下落的单词、粒子、背景星空），确保 60FPS 的流畅体验。
  - **React DOM 层**: 用于渲染静态或低频更新的 UI 元素（菜单、设置面板、分数板、模态框），便于样式管理和交互开发。

## 4. 关键设计决策

### 4.1. 纯客户端架构 (Client-Side Only)
- **决策**: 应用完全在浏览器中运行，无自定义后端服务器。
- **理由**: 降低部署成本和复杂度；数据存储在本地，保护用户隐私。
- **权衡**: 跨设备同步需要用户手动导出/导入存档。

### 4.2. 物理引擎自研
- **决策**: 不引入 Matter.js 或 Box2D，而是手写简单的圆体碰撞检测。
- **理由**: 游戏物理需求仅限于“陨石互斥”和“反弹”，引入完整物理引擎会显著增加包体积。自研算法足够轻量且易于移植（如未来迁移至鸿蒙）。

### 4.3. 动态主题与同步加载
- **决策**: `useTheme` 钩子在初始化时同步读取 `localStorage`，并使用 RGB 插值进行颜色过渡。
- **理由**: 避免异步加载导致的主题色“闪烁”（从默认紫变为用户自定义色）。插值算法确保了在切换壁纸时，UI 颜色平滑过渡，提升视觉质感。

### 4.4. 渲染性能优先的玻璃特效
- **决策**: 在动画敏感期（如页面切换）动态调整甚至关闭 `backdrop-filter`。
- **理由**: 磨砂玻璃效果极其消耗 GPU 资源，特别是在全屏动画时。通过精细的状态机控制模糊的开启与关闭，并在动画结束后移除不必要的滤镜，解决了移动端掉帧和桌面端闪烁的问题。

## 5. 数据流向

1.  **初始化**:
    - 应用加载 -> `persistence.js` 读取 `localStorage`。
    - `globalWordDb` 状态被初始化。
    - `useTheme` 同步读取保存的壁纸与主题色，计算初始 RGB 值。

2.  **游戏循环**:
    - `spawner.js` 从数据库中筛选单词。
    - 单词实例化为 Canvas 实体。
    - 用户输入 -> 校验答案。
    - **回答正确**:
        - `srs.js` 更新单词的复习数据。
        - `AIService` 触发语音朗读。
        - `visualEntities` 生成爆炸粒子。
    - **回答错误**:
        - `srs.js` 重置单词复习间隔。
        - 扣除生命值。

3.  **存档**:
    - 在关键事件（如返回菜单）或定时触发自动保存。
    - 完整状态序列化为 JSON 并写入 `localStorage`。
