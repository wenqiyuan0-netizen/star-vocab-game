import React, { useState } from 'react';
import {
  Search, Plus, Trash2, RotateCcw, X, Save,
  MoreHorizontal, FileText, CheckSquare, Square
} from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { GlassButton } from '../../../shared/components/ui/GlassButton';
import { aiService } from '../../../shared/services/ai/AIService';
import { exampleService } from '../../../shared/services/examples/ExampleService';
import { sanitizeCn } from '../../../logic/utils';
import { WordCardModal } from './WordCard';
import { generateGenderColors, getBrightestVariant } from '../../../utils/colorUtils';

export function LibraryView({
  globalWordDb = [],
  customInput = '',
  setCustomInput = () => { },
  handleBulkAdd = () => { },
  selectionMode = false,
  setSelectionMode = () => { },
  selectedIds = new Set(),
  setSelectedIds = () => { },
  handleToggleSelect = () => { },
  handleBulkDeleteRequest = () => { },
  clearSelection = () => { },
  handleDeleteWord = () => { },
  handleResetWord = () => { },
  localCorpusService,
  // 悬停/交互相关
  hoveringId = null,
  loadingExampleId = null,
  examplesById = {},
  handleMouseEnterWord = () => { },
  handleMouseLeaveWord = () => { },
  handleTouchStartWord = () => { },
  handleTouchEndWord = () => { }
}) {
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const theme = useTheme();
  // Use bright colors for dark background
  const genderColors = React.useMemo(() => generateGenderColors(theme, true), [theme]);
  const cardBgColor = React.useMemo(() => getBrightestVariant(theme.primary, 0.9), [theme.primary]);
  const ARTICLE_LIMIT = 3000;
  const [articleInput, setArticleInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [cardWord, setCardWord] = useState(null);
  const [cardEntry, setCardEntry] = useState(null);

  // 过滤单词
  const filteredWords = globalWordDb.filter(w => {
    if (!searchTerm) return true;
    const lower = searchTerm.toLowerCase();
    return w.de.toLowerCase().includes(lower) || w.cn.toLowerCase().includes(lower);
  });

  const handleWordClick = async (w) => {
    if (selectionMode) {
      handleToggleSelect(w.id);
      return;
    }

    setShowCard(true);
    setCardWord(w);
    let entry = null;
    try {
      entry = await exampleService.getDictEntry(w.de);
    } catch { }
    setCardEntry(entry);
  };


  const handleArticleChange = (e) => {
    const value = e.target.value || '';
    setArticleInput(value.slice(0, ARTICLE_LIMIT));
  };

  const getRecentFive = () => {
    const arr = [...globalWordDb].filter(w => w.lastReview).sort((a, b) => (b.lastReview || 0) - (a.lastReview || 0)).slice(0, 5);
    if (arr.length > 0) return arr;
    return [...globalWordDb].slice(0, 5);
  };

  const normalizeVocabText = (raw) => {
    const lines = String(raw || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);
    const out = [];
    const seen = new Set();
    for (let l of lines) {
      l = l.replace(/^[\-•\d]+[\.)\]]?\s*/, '');
      l = l.replace(/[，,]\s*/g, '; ');
      const parts = l.split(/;|；/);
      if (parts.length < 2) continue;
      let de = parts[0].trim().replace(/[“”"„'’]/g, '').replace(/\s+/g, ' ');
      let cn = sanitizeCn(parts.slice(1).join(';'));
      if (!de || !cn) continue;
      const key = de.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(`${de}; ${cn}`);
    }
    return out.join('\n');
  };

  const handleAiExtract = async () => {
    setAiError(null);
    setAiLoading(true);
    try {
      const recent = getRecentFive();
      const source = String(articleInput || '').trim();
      if (!source) {
        setAiError('请先粘贴德语短文');
        return;
      }

      // Check for API key
      const hasApiKey = aiService.apiKey && aiService.apiKey.trim();
      if (!hasApiKey) {
        setAiError('请在【我的】页面开启AI助手并填入API Key');
        return;
      }

      const raw = await aiService.generateVocabularyFromArticle(source, recent);
      if (!raw) {
        setAiError('生成失败');
      } else {
        const cleaned = normalizeVocabText(raw);
        if (cleaned) setCustomInput(cleaned);
      }
    } catch (e) {
      setAiError('网络或服务错误');
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddToCorpus = async () => {
    if (!articleInput || !articleInput.trim()) return;
    setAiLoading(true);
    try {
      const count = await localCorpusService.addArticle('手动导入 ' + new Date().toLocaleString(), articleInput);
      setAiError(`已成功写入 ${count} 个例句到本地库`);
      // 成功后可选：清空短文输入框
      // setArticleInput(''); 
    } catch (e) {
      console.error(e);
      setAiError('写入例句库失败');
    } finally {
      setAiLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-transparent text-white">
      {/* 顶部工具栏 */}
      <div className="flex items-center justify-between p-4 glass-panel rounded-none border-x-0 border-t-0 sticky top-0 z-20">
        <h2 className="text-xl font-bold flex items-center gap-2">
          词库 <span className="text-sm font-normal text-gray-300 glass-panel px-2 py-0.5 rounded-full">{globalWordDb.length}</span>
        </h2>

        <div className="flex items-center gap-2">
          <div className="relative group">
            <button
              onClick={() => setShowAddPanel(!showAddPanel)}
              title="增加新词"
              className={`p-2 rounded-full glass-button transition ${!showAddPanel ? 'text-gray-400' : ''}`}
              style={showAddPanel ? { backgroundColor: theme.primary, color: theme.text } : {}}
            >
              <Plus className="w-5 h-5" />
            </button>
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-xs glass-button opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">增加新词</div>
          </div>
          <div className="relative group">
            <button
              onClick={() => setSelectionMode(!selectionMode)}
              title={selectionMode ? '退出批量' : '批量管理'}
              className={`p-2 rounded-full glass-button transition ${!selectionMode ? 'text-gray-400' : ''}`}
              style={selectionMode ? { backgroundColor: `${theme.accent}33`, color: theme.accent } : {}}
            >
              {selectionMode ? <X className="w-5 h-5" /> : <CheckSquare className="w-5 h-5" />}
            </button>
            <div className="absolute -top-7 left-1/2 -translate-x-1/2 px-2 py-1 rounded-md text-xs glass-button opacity-0 group-hover:opacity-100 whitespace-nowrap pointer-events-none">{selectionMode ? '退出批量' : '批量管理'}</div>
          </div>
        </div>
      </div>

      {/* 添加面板 (折叠式) */}
      {showAddPanel && (
        <div className="p-4 glass-panel rounded-none border-x-0 border-t-0 animate-in slide-in-from-top-2">
          <div className="space-y-3">
            <div className="space-y-2">
              <textarea
                value={articleInput}
                onChange={handleArticleChange}
                placeholder="粘贴德语短文（仅德语，最长 3000 字）"
                className="w-full text-left cursor-text rounded-lg p-3 text-sm outline-none placeholder:text-gray-500 overflow-y-auto custom-scrollbar resize-none"
                style={{
                  backgroundColor: cardBgColor,
                  color: theme.text,
                  minHeight: '100px',
                  maxHeight: articleInput.length > 500 ? '240px' : '140px',
                  '--tw-ring-color': theme.primary
                }}
              />
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">仅德语 | {articleInput.length}/{ARTICLE_LIMIT}</span>
                <div className="flex gap-2">
                  {articleInput.length > 0 && (
                    <GlassButton onClick={() => setArticleInput('')} tone="secondary" variant="ghost" size="sm" title="清空短文">
                      <Trash2 className="w-4 h-4" />
                    </GlassButton>
                  )}
                  <GlassButton onClick={handleAiExtract} tone="primary" variant="solid" size="sm" disabled={aiLoading || !articleInput.trim()}>
                    {aiLoading ? '整理中...' : 'AI 生词整理'}
                  </GlassButton>
                  <GlassButton onClick={handleAddToCorpus} tone="secondary" variant="solid" size="sm" disabled={aiLoading || !articleInput.trim()}>
                    写入例句库
                  </GlassButton>
                </div>
              </div>
              {aiError && <span className="text-xs" style={{ color: theme.accent }}>{aiError}</span>}
            </div>
            <div className="relative">
              <textarea
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                placeholder="输入单词... (格式: der Apfel, 苹果)"
                className="w-full text-left cursor-text rounded-lg p-3 pr-10 text-sm outline-none placeholder:text-gray-500 overflow-y-auto custom-scrollbar resize-none"
                style={{
                  backgroundColor: cardBgColor,
                  color: theme.text,
                  minHeight: '100px',
                  maxHeight: customInput.length > 200 ? '240px' : '140px',
                  '--tw-ring-color': theme.primary
                }}
              />
              {customInput.length > 0 && (
                <button
                  onClick={() => setCustomInput('')}
                  className="absolute top-2 right-2 p-1.5 rounded-md hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
                  title="清空单词"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
            <div className="flex justify-between items-center">
              <GlassButton
                onClick={() => { handleBulkAdd(); setShowAddPanel(false); }}
                disabled={!customInput.trim()}
                tone="primary"
                variant="solid"
                size="md"
                className="rounded-lg"
              >
                添加
              </GlassButton>
            </div>
          </div>
        </div>
      )}

      {/* 批量操作栏 */}
      {selectionMode && (
        <div
          className="border-b p-2 flex items-center justify-between px-4"
          style={{ backgroundColor: `${theme.accent}33`, borderColor: `${theme.accent}33` }}
        >
          <span className="text-sm" style={{ color: theme.accent }}>已选 {selectedIds.size} 项</span>
          <div className="flex gap-2">
            <button onClick={() => setSelectedIds(new Set(globalWordDb.map(w => w.id)))} className="text-xs hover:underline" style={{ color: theme.accent }}>全选</button>
            <button onClick={clearSelection} className="text-xs hover:underline" style={{ color: theme.accent }}>清空</button>
            <button onClick={handleBulkDeleteRequest} className="px-3 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700">删除</button>
          </div>
        </div>
      )}

      {/* 搜索栏 */}
      <div className="p-4 pb-2">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/80" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索单词..."
            className="w-full glass-button bg-black/40 cursor-text rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2"
            style={{ '--tw-ring-color': theme.primary, borderColor: searchTerm ? theme.primary : undefined }}
          />
        </div>
      </div>

      {/* 单词列表 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {filteredWords.length === 0 ? (
          <div className="text-center text-gray-500 py-10">未找到单词</div>
        ) : (
          filteredWords.map(w => (
            <div
              key={w.id}
              onClick={() => handleWordClick(w)}
              onMouseEnter={() => handleMouseEnterWord(w)}
              onMouseLeave={handleMouseLeaveWord}
              onTouchStart={() => handleTouchStartWord(w)}
              onTouchEnd={handleTouchEndWord}
              className={`relative group flex items-center justify-between p-3 rounded-xl transition-all ${selectionMode
                  ? (selectedIds.has(w.id) ? '' : 'glass-panel opacity-70')
                  : 'glass-panel hover:bg-white/5'
                }`}
              style={selectionMode && selectedIds.has(w.id) ? {
                backgroundColor: `${theme.primary}33`,
                borderColor: `${theme.primary}80`,
                borderWidth: '1px'
              } : {}}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {selectionMode && (
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center`}
                    style={{
                      borderColor: selectedIds.has(w.id) ? theme.primary : '#6b7280',
                      backgroundColor: selectedIds.has(w.id) ? theme.primary : 'transparent'
                    }}
                  >
                    {selectedIds.has(w.id) && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span className="font-bold text-base truncate text-white">
                      {w.gender && (
                        <span
                          className="text-xs opacity-90 mr-1 font-serif italic"
                          style={{
                            color: genderColors[w.gender.toLowerCase()] || 'inherit'
                          }}
                        >
                          {w.gender}
                        </span>
                      )}
                      <span style={{ color: w.gender && genderColors[w.gender.toLowerCase()] ? genderColors[w.gender.toLowerCase()] : 'inherit' }}>
                        {w.de}
                      </span>
                    </span>
                    {/* 简单的熟练度指示点 */}
                    <div className="flex gap-0.5">
                      {[...Array(Math.min(5, w.familiarity || 0))].map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-green-500/50"></div>
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-gray-400 truncate">{w.cn}</p>
                </div>
              </div>

              {/* 悬停操作按钮 (非批量模式下) */}
              {!selectionMode && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleResetWord(w.id); }} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-yellow-400" title="重置进度">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteWord(w.id); }} className="p-2 hover:bg-white/10 rounded-full text-gray-400 hover:text-red-400" title="删除">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 例句浮窗 */}
              {hoveringId === w.id && !selectionMode && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 glass-panel p-3 rounded-lg text-sm pointer-events-none">
                  {loadingExampleId === w.id ? (
                    <span className="text-gray-400 animate-pulse">正在生成例句...</span>
                  ) : examplesById[w.id] ? (
                    <>
                      <p className="text-white font-medium mb-1">{examplesById[w.id].de}</p>
                      <p className="text-gray-400 text-xs">{examplesById[w.id].cn}</p>
                    </>
                  ) : (
                    <span className="text-gray-500">暂无例句</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCard && cardWord && (
        <WordCardModal
          cardBgColor={cardBgColor}
          word={{ w: cardWord, entry: cardEntry }}
          onClose={() => setShowCard(false)}
          onPrev={() => {
            const idx = filteredWords.findIndex(x => x.id === cardWord.id);
            if (idx > 0) handleWordClick(filteredWords[idx - 1]);
          }}
          onNext={() => {
            const idx = filteredWords.findIndex(x => x.id === cardWord.id);
            if (idx !== -1 && idx < filteredWords.length - 1) handleWordClick(filteredWords[idx + 1]);
          }}
          hasPrev={filteredWords.findIndex(x => x.id === cardWord.id) > 0}
          hasNext={filteredWords.findIndex(x => x.id === cardWord.id) < filteredWords.length - 1}
          currentIndex={filteredWords.findIndex(x => x.id === cardWord.id)}
          totalCount={filteredWords.length}
        />
      )}


    </div>
  );
}
