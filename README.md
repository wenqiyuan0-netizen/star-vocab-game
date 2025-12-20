# Vocab Master (德语词汇大师)

**Vocab Master** 是一款结合了游戏化玩法与现代磨砂玻璃 (Glassmorphism) 视觉风格的互动式词汇学习应用。它采用了科学的间隔重复系统 (SRS) 来帮助用户高效记忆单词（当前专注于德语-中文）。在游戏中，你需要通过输入正确的翻译来消除下落的“单词”，巩固记忆。

![Vocab Master Screenshot](public/screenshot.png)
*(注：此处可替换为实际截图)*

## 🚀 功能特性

- **沉浸式视觉体验**：
  - **极致磨砂玻璃 UI**：全站采用高通透的 Glassmorphism 设计，配合动态模糊算法，营造现代感十足的学习环境。
  - **平滑主题切换**：基于 RGB 插值的色彩过渡引擎，实现壁纸与主题色的无缝切换。
  - **自定义壁纸**：内置壁纸编辑器，支持上传图片并应用模糊、滤镜处理，打造专属学习背景。
  - **动态交互**：流畅的动画效果及平滑的转场体验。

- **游戏化学习**：
  - **单词对对碰**：通过打字或选择答案来消除单词，体验紧张刺激的游戏乐趣。
  - **听说训练**（开发中）：结合轮盘与播客的进阶听力训练模式。
  - **物理碰撞引擎**：真实的物体碰撞与反弹效果，让学习过程不再枯燥。

- **智能记忆引擎**：
  - **间隔重复 (SRS)**：内置基于 SM-2 算法的记忆引擎，根据你的掌握程度自动安排复习时间，最大化记忆效率。
  - **智能复习队列**：优先推送即将遗忘的单词，兼顾新词学习与旧词巩固。

- **AI 辅助 (Google Gemini)**：
  - **智能例句生成**：集成 Gemini API，可为单词自动生成上下文相关的德语例句。
  - **语音朗读 (TTS)**：支持浏览器原生语音合成，提供单词和例句的标准德语发音。

- **性能优化**：
  - **移动端适配**：针对移动设备优化的模糊分级策略，在保持视觉效果的同时确保流畅度。
  - **渲染优化**：精细管理的渲染管线，避免复杂玻璃特效导致的掉帧与闪烁。

- **数据自主管理**：
  - **本地优先**：所有进度自动保存于 LocalStorage，无需联网即可游玩。
  - **导入/导出**：支持 Base64 存档代码的导出与导入，方便跨设备迁移或备份。

## 🛠 技术栈

- **前端核心**: React 19, Hooks API
- **样式系统**: Tailwind CSS + CSS Modules (Glassmorphism Utility Classes)
- **渲染引擎**: HTML5 Canvas API (用于高性能游戏画面)
- **图标库**: Lucide React
- **AI 集成**: Google Gemini API (`gemini-2.5-flash-preview`)
- **构建工具**: Create React App

## 📦 安装与运行

### 前置要求
- Node.js (建议 v14 或更高版本)
- npm 或 yarn

### 启动步骤

1. **克隆仓库**
   ```bash
   git clone <repository-url>
   cd star-vocab-game
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动开发服务器**
   ```bash
   npm start
   ```
   应用将在 `http://localhost:3000` 运行。

### 功能开关 (Feature Flags)

本项目使用 Feature Flags 来控制实验性功能的开启与关闭。

#### 如何开启“听说模式” (Listening Mode)
“听说模式”目前处于实验阶段，默认关闭。如需开启：

1. 打开文件 `src/shared/services/FeatureFlagService.js`
2. 找到 `mockBackendResponse` 对象
3. 将 `enableListeningSpeaking` 设置为 `true`：

```javascript
const mockBackendResponse = {
    enableListeningSpeaking: true // 设置为 true 开启
};
```

## 🎮 使用指南

### 1. 游戏玩法
- **目标**：阻止单词陨石撞击屏幕底部的基地。
- **操作**：
  - **单词模式**：输入屏幕上单词对应的中文翻译或德语原词。
  - **连击机制**：连续正确回答将触发 Combo 加成，获得更高分数与视觉特效。

### 2. 个性化设置
- **壁纸设置**：点击主页左上角菜单 -> 壁纸设置，上传你喜欢的图片，调节模糊度和滤镜，设为专属背景。
- **AI 配置**：点击设置 (齿轮图标)，填入 Google Gemini API Key 以启用智能例句功能。

### 3. 数据管理
- **备份**：前往 设置 -> 数据管理，复制存档代码。
- **恢复**：粘贴存档代码以恢复游戏进度。

## 🤝 贡献指南

欢迎提交 Issue 或 Pull Request 来改进本项目！我们特别关注以下方向的改进：
- 新的游戏模式
- 更多的词库支持
- 性能优化

1. Fork 本项目
2. 创建特性分支 (`git checkout -b feature/NewFeature`)
3. 提交改动 (`git commit -m 'Add NewFeature'`)
4. 推送到分支 (`git push origin feature/NewFeature`)
5. 提交 Pull Request

## 📄 许可证

本项目采用 MIT 许可证。
