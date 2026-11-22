# 听说模式 (Listening/Speaking Mode) 设计文档

## 0. 设计目标与约束

本模块严格遵循“前后端分离”原则：

- **前端（客户端）**：负责 UI 渲染、交互反馈、音频播放、录音采集。前端**不直接操作数据库**，也不包含核心业务规则（如 SRS 调度算法、防作弊校验）。
- **后端（Supabase）**：负责数据存储、业务逻辑计算（抽词、复习调度、结算）、数据一致性校验。所有状态变更必须通过 RPC (Stored Procedures) 或 Edge Functions 执行。
- **本地优先与同步**：前端可缓存数据以支持离线体验，但在联网时必须通过后端 API 同步并以服务器端状态为准。

## 1. 核心玩法：长期积累与决战时刻 (Accumulation & The Moment of Truth)

听说模式的流程分为两个截然不同的阶段：**日常积累 (Grinding)** 和 **决战时刻 (The Challenge)**。

### 1.1 阶段一：日常积累 (Grinding Phase)
这是一个轻松的、碎片化的过程。
- **机制**：你随时可以进入游戏，进行听音辨词的赌局 (Gamble)。
- **目标**：赚取积分（Chars）。
- **持久化**：积分是**永久累积**的。你可以今天玩几把赚 300 分，明天玩几把赚 500 分。
- **无惩罚退出**：在这个阶段，随时退出游戏没有任何惩罚。你的积分会保留在“听说钱包”中。

### 1.2 阶段二：决战时刻 (The Challenge Phase)
当你攒够了足够的积分（当前设定为 **300 Chars**），你可以选择消耗这些积分来**“生成播客” (Generate Podcast)**。一旦点击这个按钮，游戏性质立刻改变，进入**高风险模式**。

- **生成**：系统消耗积分，利用 Gemini 语音合成技术，为你量身定制一段包含你最近练习单词的播客音频。
- **强制任务**：你必须在**当天（或 24 小时内）**完成对这段播客的**跟读 (Shadowing)** 任务。
- **成功奖励**：
    - 播客语料被永久保存到**“材料库” (Library)**。
    - 你可以随时回听、复习这些语料，并获得**全局游戏经验 (XP)**（用于账号升级）。
- **失败惩罚**：
    - 如果你未在规定时间内完成跟读，或者中途放弃：
        1.  本次生成的播客语料**直接销毁**，不进入材料库。
        2.  你会获得一个 **Debuff**：下一次进入“日常积累”阶段时，你的积分获取倍率 (Multiplier) 强制变为 **0.5x**。

---

## 2. 详细流程与 UI (Detailed Flow)

### 2.1 Hub（入口与仪表盘）
- **状态展示**：
    - **当前积分池**：显示累积的积分（例如 `150 / 300`）。
    - **Debuff 标记**：如果上次挑战失败，显示“收益减半”警告。
- **主要操作**：
    - `Play (Gamble)`：进入单词赌局赚积分。
    - `Generate Podcast`：当积分 >= 300 时高亮可用。点击即扣除积分，并立即跳转到播放器，开始“决战时刻”。
- **次要入口**：
    - `Library`：进入材料库，复习已归档的播客。

### 2.2 Gamble Screen（赚积分）
- **玩法**：同前述，掷骰子决定倍率，听音填空/翻译。
- **变化**：这里赚取的积分直接存入持久化的钱包，而不是临时 Session。
- **退出**：随时可以退出，进度自动保存。

### 2.3 Player & Shadowing Screen（决战时刻）
这是消耗积分后进入的界面。
- **内容**：播放生成的播客音频。
- **交互**：
    - 逐句跟读：系统通过 Web Speech API 或简单的时长检测判断是否跟读。
    - 进度条：必须填满跟读进度条。
- **完成**：
    - 弹出“归档成功”提示。
    - 语料存入 Supabase 的 `listening_materials` 表。
    - 清除 Debuff（如果有）。

### 2.4 Library（材料库）
- **列表**：按日期列出所有成功归档的播客。
- **功能**：点击播放，反复跟读。
- **收益**：在此模式下的练习不再产出“听说积分”，而是产出“全局 XP”。

---

## 3. 关键机制与算法 (Mechanics)

### 3.1 钱包与 Debuff
- 数据库表 `listening_wallet`：
    - `balance`: 当前积分余额。
    - `penalty_multiplier`: 默认为 1.0。失败后设为 0.5。成功归档一次后重置为 1.0。

### 3.2 临时 Session (The "Challenge" Session)
- 当点击“生成播客”时，创建一个临时的 `listening_challenge_session`。
- 包含：生成的文本、音频 URL、过期时间 (Now + 24h)。
- 如果过期未完成 (`status != 'completed'`)，则触发惩罚逻辑。
- 系统在加载时会自动检查是否有过期未完成的挑战，并应用惩罚。

### 3.3 渐进式难度 (Progressive Difficulty)
（保持不变，用于 Gamble 阶段的单词生成）

---

## 4. 技术实现规划 (Implementation Steps)

### Step 1: 数据库与后端逻辑 (Backend) - [Done]
- [x] 创建 `user_word_skills` 表支持独立 SRS。
- [x] 创建 `user_daily_plans` 表支持每日进度。
- [x] 实现 `get_new_listening_candidates` RPC：支持去重、例句获取。
- [x] 实现 `submit_listening_review` RPC：处理 SRS 算法、状态更新。
- [x] 实现 `check_listening_challenge_expiry` RPC：处理过期逻辑。

### Step 2: 游戏核心逻辑 (Game Logic Hook) - [Done]
- [x] 复用 Word Match 的 Session 概念，但在 `useListeningGameLogic` 中适配。
- [x] 实现渐进式难度生成器 (`generateChallenge`)。
- [x] 集成后端 RPC 接口，替换 Mock 数据。
- [x] 实现 24小时过期检查逻辑。

### Step 3: UI 交互层 (UI Components) - [Done]
- [x] `GambleScreen`: 基础答题与 Roll 点，支持钱包余额显示。
- [x] `HubScreen`: 展示今日进度与惩罚状态，支持生成播客入口。
- [x] `PracticeScreen`: 播客播放与跟读。
- [x] `ListeningGame`: 整合各视图路由。

### Step 4: 整合与测试 (Integration) - [In Progress]
- [ ] 联调：前端调用 RPC -> 数据库更新 -> 前端 UI 反馈。
- [ ] 测试：24小时过期逻辑（通过修改本地时间或数据库时间模拟）。
