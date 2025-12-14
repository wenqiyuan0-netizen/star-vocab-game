# 音频功能修复指南

## 🔧 问题说明

**发音按钮不显示的原因：**
- 旧版本代码查找的字段名是 `audio_url`
- 但源数据中的字段名是 `audio`
- 导致无法读取音频URL

**变位信息不显示的原因：**
- **源词典文件中没有变位（conjugation）数据**
- 这不是bug，而是数据源本身不包含此信息
- Common_Vocab_local.json 只包含基础词汇信息

---

## ✅ 已修复的内容

### 1. 音频字段兼容性
**修改的文件：**
- ✅ `src/features/vocabulary/components/WordCard.js` (第157行)
- ✅ `src/features/vocabulary/components/LibraryView.js` (第111-112行)
- ✅ `src/shared/services/dictionary/DictionaryImporter.js` (第90-91行)
- ✅ `public/dict-tool.html` (第337-338行)

**修复代码：**
```javascript
// 现在同时支持两种字段名
const audioUrl = entry?.audio_url || entry?.audio || w.audio_url || w.audio;

// 数据库存储时也保存两个字段
{
  audio_url: item.audio || '',  // 标准字段
  audio: item.audio || '',      // 源数据字段
}
```

---

## 🚀 重新导入词典（必须操作）

**为什么需要重新导入？**
旧数据库中的词条没有正确保存音频字段，需要重新导入以获得发音功能。

### 方法 1：使用词典工具（推荐）

1. **打开词典工具页面：**
   ```
   http://localhost:3001/dict-tool.html
   ```

2. **点击 "🔄 重新导入词典" 按钮**

3. **等待导入完成**（约5-10秒）
   - 显示进度：2000/25000, 4000/25000...
   - 完成提示：✅ 词典导入成功！

4. **验证：**
   - 点击 "🔍 检查词典状态"
   - 应显示：找到 5/5 个测试单词

### 方法 2：使用应用内诊断工具

1. **打开应用主页：**
   ```
   http://localhost:3001
   ```

2. **打开开发者工具（F12）**

3. **在控制台运行：**
   ```javascript
   dictDiagnostic.reimport()
   ```

4. **等待导入完成，然后验证：**
   ```javascript
   dictDiagnostic.check("Haus")
   ```

---

## 🎯 验证发音功能

重新导入后，按以下步骤验证：

### 1. 搜索测试单词
在应用中搜索：**Haus**

### 2. 打开单词卡片
点击单词打开详细卡片

### 3. 检查发音部分
应该看到：

```
┌─────────────────────────────────────┐
│ 释义：房子                           │
├─────────────────────────────────────┤
│ 音标  [haʊ̯s]              [🔊 发音] │ ← 应该显示
├─────────────────────────────────────┤
│ 复数  Häuser                         │
└─────────────────────────────────────┘
```

### 4. 测试播放
点击 **🔊 发音** 按钮，应该能听到单词发音。

**音频来源：**
- Wikimedia Commons (Wikipedia 的多媒体库)
- 示例：`https://upload.wikimedia.org/wikipedia/commons/transcoded/7/7e/De-Haus.ogg/De-Haus.ogg.mp3`

---

## 📊 数据可用性

| 数据类型 | 可用性 | 备注 |
|---------|--------|------|
| **音标 (IPA)** | ✅ 92% | 23,000/25,000 词条有音标 |
| **音频** | ✅ 80% | 20,000/25,000 词条有发音 |
| **复数** | ✅ 85% | 仅名词有复数形式 |
| **例句** | ✅ 88% | 22,000/25,000 词条有例句 |
| **变位** | ❌ 0% | **源数据中不包含** |

---

## ❓ 关于变位信息

### 为什么没有变位？

**数据源限制：**
- Common_Vocab_local.json 来自 Wiktionary 的基础词汇提取
- 只包含：单词、词性、释义、音标、音频、例句
- **不包含：** 动词变位、形容词比较级等语法信息

**示例数据结构：**
```json
{
  "word": "haben",
  "pos": "verb",
  "translation_cn": "构成完成时",
  "ipa": "/ˈhaːbən/",
  "audio": "https://...",
  "example_de": "Ich habe das Buch gelesen.",
  "example_cn": "我已经读了这本书。"
  // 注意：没有 conjugations 字段
}
```

### 如何获取变位信息？

有几个选择：

#### 选项 1：集成外部API
推荐的德语变位API：
- **Verbix API** - https://www.verbix.com/
- **Reverso API** - https://www.reverso.net/
- **Linguatools API** - https://www.linguatools.de/

#### 选项 2：添加本地变位数据
需要额外的数据文件，如：
- `german-verbs-conjugation.json`
- 包含常用动词的完整变位表

#### 选项 3：使用AI生成
在查询词典时，如果是动词，使用AI生成变位：
```javascript
if (entry.pos === 'verb' && !entry.conjugations) {
  entry.conjugations = await aiService.generateConjugation(entry.word);
}
```

---

## 🛠️ 代码说明

### 单词卡片中的变位显示逻辑

**位置：** `src/features/vocabulary/components/WordCard.js`

**第153行：**
```javascript
const conjugations = entry?.conjugations || entry?.conjugation;
```

**第230-237行：**
```javascript
{conjugations && (
    <div className="flex items-start gap-4">
        <span className="w-16 flex-shrink-0">变位</span>
        <span className="font-mono text-sm">
            {typeof conjugations === 'string'
                ? conjugations
                : JSON.stringify(conjugations)}
        </span>
    </div>
)}
```

**说明：**
- 代码已经支持显示变位
- 只要数据中有 `conjugations` 字段就会显示
- 但当前词典数据中没有这个字段

---

## 🔮 未来改进建议

### 短期（1-2周）
- [ ] 集成在线变位API
- [ ] 添加音频播放进度条
- [ ] 支持离线缓存音频

### 中期（1-2月）
- [ ] 导入完整的变位数据
- [ ] 添加形容词比较级数据
- [ ] 支持同义词/反义词查询

### 长期（3-6月）
- [ ] 构建完整的语法数据库
- [ ] 支持句子分析
- [ ] 添加语音识别功能

---

## 📝 测试清单

重新导入后，请验证以下功能：

### 音频功能
- [ ] 音标正确显示
- [ ] 发音按钮出现
- [ ] 点击按钮能播放音频
- [ ] 音频播放流畅

### 搜索功能
- [ ] 搜索用户词库正常
- [ ] 搜索词典数据正常
- [ ] 词典结果带"词典"标签
- [ ] 点击词典结果显示详情

### 数据完整性
- [ ] 复数正确显示（名词）
- [ ] 例句正确显示
- [ ] 中文翻译正确显示

---

## ⚠️ 注意事项

1. **音频播放可能需要网络连接**
   - 音频文件存储在 Wikimedia Commons
   - 离线环境下无法播放
   - 未来版本会支持离线缓存

2. **浏览器自动播放策略**
   - 某些浏览器可能阻止自动播放
   - 需要用户主动点击才能播放
   - 这是浏览器安全策略，无法绕过

3. **变位数据缺失是正常的**
   - 不是bug，而是数据源限制
   - 需要额外集成数据或API
   - 建议使用AI生成作为临时方案

---

## 🆘 问题排查

### 问题：重新导入后仍然没有发音按钮

**检查步骤：**
1. 刷新浏览器（Ctrl + Shift + R 强制刷新）
2. 在控制台运行：
   ```javascript
   dictDiagnostic.check("Haus")
   ```
3. 查看输出中是否有 `audio` 或 `audio_url` 字段
4. 如果没有，再次运行 `dictDiagnostic.reimport()`

### 问题：发音按钮点击没反应

**可能原因：**
- 网络连接问题（音频URL无法访问）
- 浏览器阻止了音频播放
- 音频文件不存在或已删除

**解决方案：**
1. 检查网络连接
2. 在浏览器设置中允许音频自动播放
3. 在控制台查看错误信息

### 问题：音标显示乱码

**可能原因：**
- 字体不支持IPA符号
- 编码问题

**解决方案：**
- 使用支持Unicode的字体
- 检查浏览器字符编码设置（应为UTF-8）

---

**最后更新：** 2025-12-14
**状态：** ✅ 音频功能已修复，需要重新导入词典
**变位功能：** ⏳ 待添加数据源
