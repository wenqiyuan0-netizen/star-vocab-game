# 🎙️ TTS 朗读功能说明

## 📋 功能概述

单词卡片现在支持**智能朗读降级**：
1. ✅ **优先使用真实音频**：如果有音频URL，播放维基百科的真人发音
2. ✅ **自动降级到TTS**：如果音频不存在或加载失败，自动使用浏览器的语音合成API
3. ✅ **始终可用**：所有单词都可以朗读，不再受限于音频源

---

## 🔧 实现原理

### 朗读优先级

```javascript
用户点击朗读按钮
  ↓
检查是否有音频URL？
  ↓
【有】尝试加载音频
  ├── 成功 → 播放真人音频 ✅
  ├── 超时（3秒）→ 降级到TTS 🔄
  └── 失败 → 降级到TTS 🔄
  ↓
【无】直接使用TTS 🎵
```

### TTS 配置

```javascript
const utterance = new SpeechSynthesisUtterance(word);
utterance.lang = 'de-DE';   // 德语
utterance.rate = 0.85;      // 语速：85%（稍慢，便于学习）
utterance.pitch = 1.0;      // 音调：标准
```

---

## 🎯 用户体验

### 视觉区分

| 场景 | 按钮文字 | Tooltip | 实际播放 |
|------|----------|---------|---------|
| **有音频URL** | 🔊 发音 | "播放发音（音频）" | 真人音频 |
| **无音频URL** | 🔊 TTS | "播放发音（TTS）" | 浏览器TTS |

### 交互流程

1. **首次点击**
   - 有音频：尝试播放，可能有短暂延迟（网络加载）
   - 无音频：立即TTS朗读

2. **音频失败**
   - 控制台输出警告
   - 自动切换到TTS
   - 用户无感知中断

3. **重复点击**
   - 停止当前播放
   - 重新开始朗读

---

## 🧪 测试场景

### 场景 1: 有音频的单词（如 "und"）

**步骤**:
1. 打开单词卡片
2. 点击 🔊 发音 按钮
3. 观察控制台

**预期结果**:
```
[WordCard] Audio played: https://upload.wikimedia.org/wikipedia/commons/...
```

**实际播放**: Wikimedia Commons 真人音频

---

### 场景 2: 无音频的单词（自己添加的）

**步骤**:
1. 导入新单词（如 "TestWort;测试"）
2. 打开单词卡片
3. 观察按钮文字：应显示 "TTS"
4. 点击按钮

**预期结果**:
```
[WordCard] No audio URL, using TTS
[WordCard] TTS playing: TestWort
```

**实际播放**: 浏览器TTS语音

---

### 场景 3: 音频加载失败

**模拟方法**:
1. 断开网络（或使用DevTools限速）
2. 打开有音频的单词
3. 点击朗读按钮

**预期结果**:
```
[WordCard] Audio playback failed, using TTS: ...
[WordCard] TTS playing: und
```

**实际播放**: TTS降级播放

---

### 场景 4: 音频加载超时（>3秒）

**模拟方法**:
```javascript
// 在 DevTools Console 中执行
// 模拟慢速网络
performance.setResourceTimingBufferSize(0);
```

**预期结果**:
3秒后自动降级到TTS

---

## 🌐 浏览器兼容性

### Web Speech API 支持

| 浏览器 | 支持 | 德语语音 | 备注 |
|--------|------|---------|------|
| **Chrome** | ✅ | ✅ | 完美支持，多种德语语音 |
| **Edge** | ✅ | ✅ | 与Chrome相同 |
| **Safari** | ✅ | ✅ | 支持，但语音选择较少 |
| **Firefox** | ⚠️ | ⚠️ | 支持，但依赖系统语音 |
| **iOS Safari** | ✅ | ✅ | 支持，但需要用户交互触发 |
| **Android Chrome** | ✅ | ✅ | 支持 |

### 检查浏览器支持

```javascript
// 在控制台执行
if ('speechSynthesis' in window) {
    console.log('✅ TTS supported');
    speechSynthesis.getVoices().forEach(voice => {
        if (voice.lang.startsWith('de')) {
            console.log(`德语语音: ${voice.name} (${voice.lang})`);
        }
    });
} else {
    console.log('❌ TTS not supported');
}
```

---

## ⚙️ 配置选项

### 调整语速

如果觉得TTS语速不合适，可以修改：

```javascript
// src/features/vocabulary/components/WordCard.js:318
utterance.rate = 0.85;  // 范围: 0.1 - 10 (建议: 0.7 - 1.2)
```

| rate | 说明 |
|------|------|
| 0.7 | 很慢，适合初学者 |
| 0.85 | 稍慢（当前默认） |
| 1.0 | 正常速度 |
| 1.2 | 稍快 |

### 调整音调

```javascript
utterance.pitch = 1.0;  // 范围: 0 - 2 (建议: 0.8 - 1.2)
```

---

## 🐛 故障排除

### 问题 1: TTS 没有声音

**可能原因**:
- 系统音量静音
- 浏览器静音
- 没有安装德语语音包（Windows/Mac）

**解决方法**:
```javascript
// 检查可用语音
speechSynthesis.getVoices().forEach(v => console.log(v.name, v.lang));

// 如果没有 de-DE，尝试下载语音包
// Windows: 设置 → 时间和语言 → 语音 → 管理语音
// Mac: 系统偏好设置 → 辅助功能 → 语音
```

---

### 问题 2: TTS 发音不准确

**原因**: 浏览器TTS基于规则，无法处理所有例外情况

**解决方法**:
- 优先使用有真实音频的单词
- 参考IPA音标学习正确发音
- 考虑使用外部TTS服务（如Google TTS API）

---

### 问题 3: 音频和TTS都不工作

**检查清单**:
```javascript
// 1. 检查音频URL
console.log(word.audio_url || word.audioUrl || word.audio);

// 2. 检查TTS支持
console.log('TTS:', 'speechSynthesis' in window);

// 3. 手动测试TTS
const test = new SpeechSynthesisUtterance('Hallo');
test.lang = 'de-DE';
speechSynthesis.speak(test);

// 4. 检查浏览器权限
// 某些浏览器需要用户交互才能播放音频
```

---

## 📊 性能影响

### 包大小

```
添加 TTS 降级逻辑前: 250.1 KB
添加 TTS 降级逻辑后: 250.35 KB
增加: +249 B (0.1%)
```

### 运行时性能

- ✅ **音频播放**: 无额外开销
- ✅ **TTS播放**: 浏览器原生API，性能优秀
- ✅ **超时检测**: 仅3秒延迟，不阻塞UI
- ✅ **内存占用**: 可忽略不计

---

## 🚀 未来优化方向

### 1. 语音选择器

允许用户选择喜欢的德语语音：

```javascript
// 获取所有德语语音
const germanVoices = speechSynthesis.getVoices()
    .filter(v => v.lang.startsWith('de'));

// UI: 下拉选择框
<select onChange={(e) => setPreferredVoice(e.target.value)}>
    {germanVoices.map(v => <option value={v.name}>{v.name}</option>)}
</select>
```

---

### 2. 云端TTS服务

对于更高质量的发音，可以集成：

| 服务 | 质量 | 价格 |
|------|------|------|
| **Google TTS** | ⭐⭐⭐⭐⭐ | $4/百万字符 |
| **Azure TTS** | ⭐⭐⭐⭐⭐ | $4/百万字符 |
| **Amazon Polly** | ⭐⭐⭐⭐ | $4/百万字符 |

---

### 3. 离线语音包

预下载高质量德语语音包，完全离线使用：

```javascript
// 使用 pico2wave 或类似工具
// 构建时生成音频文件
// 打包到应用中
```

---

## 📝 代码位置

| 文件 | 行数 | 功能 |
|------|------|------|
| `WordCard.js` | 309-327 | TTS播放函数 |
| `WordCard.js` | 329-358 | 智能降级逻辑 |
| `WordCard.js` | 463-494 | UI显示逻辑 |

---

## ✅ 测试清单

使用前请完成以下测试：

- [ ] 有音频的单词能正常播放音频
- [ ] 无音频的单词能使用TTS朗读
- [ ] 音频加载失败时能自动降级
- [ ] TTS发音基本准确（德语）
- [ ] 按钮文字正确显示（"发音" vs "TTS"）
- [ ] 重复点击能停止并重新播放
- [ ] 在移动设备上测试（iOS/Android）
- [ ] 检查控制台无错误信息

---

**生成时间**: 2026-01-02
**功能版本**: v1.0
**相关文件**: WordCard.js, DICT_OPTIMIZATION_SUMMARY.md
