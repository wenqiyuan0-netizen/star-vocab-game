import React, { useState, useEffect } from 'react';
import {
  Search, Plus, Trash2, RotateCcw, X, Save,
  MoreHorizontal, FileText, CheckSquare, Square, BookOpen
} from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { GlassButton } from '../../../shared/components/ui/GlassButton';
import { PresetLibrarySelector } from './PresetLibrarySelector';
import { aiService } from '../../../shared/services/ai/AIService';
import { exampleService } from '../../../shared/services/examples/ExampleService';
import { sanitizeCn } from '../../../logic/utils';
import { WordCardModal } from './WordCard';
import { useFocusNavigation } from '../../../shared/hooks/useFocusNavigation';
import { generateGenderColors, getBrightestVariant, mixColors, withOpacity } from '../../../utils/colorUtils';
import { genderToArticle } from '../../../utils/genderUtils';
import { localDictDB } from '../../../shared/services/dictionary/LocalDictionaryDB';
import { unifiedDictService } from '../../../shared/services/dictionary/UnifiedDictionaryService';
import { localLemmatization } from '../../../utils/localLemmatization';
import { processImportInput } from '../services/WordProcessor';

// Main Library View Component
export function LibraryView({
  globalWordDb = [],
  setGlobalWordDb = () => { },
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

  // 新增状态：预设词库导入
  const [importedLibraries, setImportedLibraries] = useState(() => {
    // 从 localStorage 恢复已导入的词库列表
    try {
      const saved = localStorage.getItem('imported_preset_libraries');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }); // 数组，存储已导入的词库 ID
  const [showPresetLibrary, setShowPresetLibrary] = useState(false);

  // 1. Gender Colors
  // Light/Bright colors for Dark Background (Normal State)
  const brightGenderColors = React.useMemo(() => generateGenderColors(theme, true), [theme]);
  // Dark/Deep colors for Light Background (Hover State)
  const darkGenderColors = React.useMemo(() => generateGenderColors(theme, false), [theme]);
  // Pastel/Tinted White colors for Dark Background (New Normal State for Article/Noun)
  // Logic: Mix White (90%) with Gender Color (10%)
  const pastelGenderColors = React.useMemo(() => {
    const colors = {};
    Object.keys(brightGenderColors).forEach(key => {
      colors[key] = mixColors('#ffffff', brightGenderColors[key], 0.15); // 15% tint
    });
    return colors;
  }, [brightGenderColors]);

  // Deep/Tinted Black colors for Light Background (New Hover State for Article/Noun)
  // Logic: Mix Dark Gray (40%) with Dark Gender Color (60%) to get "Black tinted with gender color"
  const deepGenderColors = React.useMemo(() => {
    const colors = {};
    Object.keys(darkGenderColors).forEach(key => {
      colors[key] = mixColors('#1f2937', darkGenderColors[key], 0.4);
    });
    return colors;
  }, [darkGenderColors]);

  // 2. Background Colors
  // Normal: Dark Glassy (Referencing .glass-button style: rgba(0, 0, 0, 0.25))
  const cardBaseColor = 'rgba(57, 57, 57, 0.25)';
  // Hover: White with slight theme tint (Brighten effect), slightly more transparent/darker
  // Changed from #ffffff to #fdfdfdff (Light Gray) and opacity 0.75 for a dimmer, more glassy look
  const cardHoverColor = React.useMemo(() => withOpacity(mixColors('#e5e5e5', theme.primary, 0.05), 0.75), [theme]);

  const cardBgColor = React.useMemo(() => getBrightestVariant(theme.primary, 0.9), [theme.primary]);
  const ARTICLE_LIMIT = 3000;
  const [articleInput, setArticleInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [showCard, setShowCard] = useState(false);
  const [cardEntry, setCardEntry] = useState(null);
  const [dictSearchResults, setDictSearchResults] = useState([]);
  const [searchLemma, setSearchLemma] = useState(null);

  // 分页显示，避免一次性渲染大量数据导致卡顿
  const [visibleCount, setVisibleCount] = useState(50);

  // 搜索词典数据库
  useEffect(() => {
    if (!searchTerm || searchTerm.trim().length < 2) {
      setDictSearchResults([]);
      setSearchLemma(null);
      return;
    }

    const searchDict = async () => {
      try {
        await localDictDB.initPromise;
        const normalizedTerm = searchTerm.trim().toLowerCase();
        
        // 1. 尝试获取原型 (Lemmatization)
        let lemma = null;
        try {
            lemma = await localLemmatization.findLemma(searchTerm.trim());
            // 如果原型和搜索词相同，或者找不到原型，则 lemma 为 null 或相同词
            if (lemma && lemma.toLowerCase() === normalizedTerm) {
                lemma = null;
            }
        } catch (err) {
            console.warn('[LibraryView] Lemmatization failed:', err);
        }
        
        setSearchLemma(lemma);

        // 2. 搜索数据库 (原词 + 原型)
        const searchPromises = [localDictDB.getEntriesByWord(normalizedTerm)];
        if (lemma) {
            console.log(`[LibraryView] Searching for lemma: ${lemma} (original: ${searchTerm})`);
            searchPromises.push(localDictDB.getEntriesByWord(lemma));
        }

        const results = await Promise.all(searchPromises);
        let entries = results[0] || []; // 原词结果
        
        // 如果有原型结果，合并进来
        if (results[1] && results[1].length > 0) {
            // 简单的去重合并 (基于 ID 或 word)
            const existingIds = new Set(entries.map(e => e.id || e.word));
            const newEntries = results[1].filter(e => !existingIds.has(e.id || e.word));
            entries = [...entries, ...newEntries];
        }

        // 使用统一服务合并重复词条
        // 简单处理：如果只有一个词（或合并后被视为一个），则合并
        // 否则，按单词分组后分别合并
        const groupedByWord = {};
        entries.forEach(e => {
            const key = (e.word || e.headword || '').toLowerCase();
            if (!groupedByWord[key]) groupedByWord[key] = [];
            groupedByWord[key].push(e);
        });
        
        const displayList = [];
        Object.values(groupedByWord).forEach(group => {
             const merged = unifiedDictService.mergeEntries(group);
             if (merged) displayList.push(merged);
        });

        const convertedEntries = displayList
          .filter(e => e.has_chinese || e.translation || e.translation_cn) // 只显示有翻译的
          .map(e => {
            const converted = {
              id: `dict_${e.id || e.word}`,
              de: e.word,
              cn: e.translation || e.translation_cn || e.translation_en,
              pos: e.pos,
              gender: e.gender,
              article: e.article,
              plural: e.plural,
              ipa: e.ipa,
              audio_url: e.audio_url || e.audio,
              audio: e.audio || e.audio_url,
              _fromDict: true,
              _dictEntry: e,
              // 传递合并后的来源标签
              source_tags: e.source_tags
            };
            return converted;
          });

        console.log(`[LibraryView] Dictionary search: found ${convertedEntries.length} entries for "${searchTerm}"`);
        setDictSearchResults(convertedEntries);
      } catch (error) {
        console.error('[LibraryView] Dictionary search error:', error);
        setDictSearchResults([]);
      }
    };

    const debounceTimer = setTimeout(searchDict, 300);
    return () => clearTimeout(debounceTimer);
  }, [searchTerm]);

  // 过滤用户词库 + 合并词典搜索结果
  const filteredWords = React.useMemo(() => {
    // 1. 过滤用户词库
    const userWords = globalWordDb.filter(w => {
      if (!searchTerm) return true;
      const lower = searchTerm.toLowerCase();
      // 匹配原词 OR 匹配原型 (如果存在)
      const matchOriginal = w.de.toLowerCase().includes(lower) || w.cn.toLowerCase().includes(lower);
      const matchLemma = searchLemma && w.de.toLowerCase().includes(searchLemma.toLowerCase());
      
      return matchOriginal || matchLemma;
    });

    // 2. 如果有搜索词，添加词典结果（排除已在用户词库中的）
    if (searchTerm && dictSearchResults.length > 0) {
      const userWordSet = new Set(userWords.map(w => w.de.toLowerCase()));
      const uniqueDictWords = dictSearchResults.filter(
        d => !userWordSet.has(d.de.toLowerCase())
      );

      return [...userWords, ...uniqueDictWords];
    }

    return userWords;
  }, [globalWordDb, searchTerm, dictSearchResults, searchLemma]);

  // 重置分页
  React.useEffect(() => {
    setVisibleCount(50);
  }, [filteredWords]);

  // 计算当前显示的词列表
  const visibleWords = React.useMemo(() => {
    return filteredWords.slice(0, visibleCount);
  }, [filteredWords, visibleCount]);

  // 滚动加载更多（添加防抖优化，避免频繁触发）
  const handleListScroll = React.useCallback((e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // 降低阈值到 300px，让用户更早看到新内容
    if (scrollHeight - scrollTop - clientHeight < 300) {
      if (visibleCount < filteredWords.length) {
        setVisibleCount(prev => Math.min(prev + 50, filteredWords.length));
      }
    }
  }, [visibleCount, filteredWords.length]);

  // Focus Navigation Hook
  const {
    currentIndex,
    setCurrentIndex,
    goNext,
    goPrev,
    hasNext,
    hasPrev
  } = useFocusNavigation(filteredWords.length);

  // Derived cardWord from index
  const cardWord = React.useMemo(() => {
    if (!showCard || currentIndex < 0 || currentIndex >= filteredWords.length) return null;
    return filteredWords[currentIndex];
  }, [showCard, currentIndex, filteredWords]);

  // Load entry when cardWord changes
  React.useEffect(() => {
    if (cardWord) {
      let active = true;
      const load = async () => {
        setCardEntry(null);
        try {
          const entry = await exampleService.getDictEntry(cardWord.de);
          if (active) setCardEntry(entry);
        } catch { }
      };
      load();
      return () => { active = false; };
    }
  }, [cardWord]);

  const modalWordData = React.useMemo(() => {
    if (!cardWord) return null;
    return { w: cardWord, entry: cardEntry };
  }, [cardWord, cardEntry]);

  // Calculate dynamic background for Focus Mode (same as TodayView)
  const focusCardBg = React.useMemo(() => {
    if (!modalWordData) return cardBgColor;
    const g = modalWordData.w.gender;
    const gc = g ? darkGenderColors[g.toLowerCase()] : null;
    return gc ? mixColors(cardBgColor, gc, 0.15) : cardBgColor;
  }, [modalWordData, cardBgColor, darkGenderColors]);

  const handleWordClick = (w) => {
    if (selectionMode) {
      handleToggleSelect(w.id);
      return;
    }
    const idx = filteredWords.findIndex(x => x.id === w.id);
    if (idx !== -1) {
      setCurrentIndex(idx);
      setShowCard(true);
    }
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

  // 处理预设词库按钮点击
  const handlePresetLibraryClick = () => {
    setShowPresetLibrary(true);
  };

  // 处理删除导入的词库（只删除未学习的）
  const handleDeleteLibrary = (libraryId, libraryName) => {
    // 筛选出未学习的单词（state='new' 且从未复习过）
    const unlearnedWords = globalWordDb.filter(w =>
      w.state === 'new' && (!w.lastReview || w.lastReview === 0 || w.lastReview === null)
    );

    const learnedWords = globalWordDb.filter(w =>
      w.state !== 'new' || (w.lastReview && w.lastReview > 0)
    );

    const deletedCount = unlearnedWords.length;

    // 更新词库，只保留已学习的单词
    setGlobalWordDb(learnedWords);

    // 从已导入列表中移除
    const newImportedLibraries = importedLibraries.filter(id => id !== libraryId);
    setImportedLibraries(newImportedLibraries);
    localStorage.setItem('imported_preset_libraries', JSON.stringify(newImportedLibraries));

    // 显示提示
    alert(`已删除 ${libraryName}\n删除了 ${deletedCount} 个未学习的单词，保留了 ${learnedWords.length} 个已学习的单词`);
  };

  // 处理预设词库导入
  const handlePresetLibraryImport = (text, libraryName, libraryId) => {
    console.log('[LibraryView] Importing preset library:', libraryName);
    console.log('[LibraryView] Text length:', text.length);

    // 直接处理导入
    const result = processImportInput(text, globalWordDb);

    if (result.message) {
      // 显示导入结果消息
      setTimeout(() => {
        alert(result.message);
      }, 100);
    }

    if (result.success && result.updatedDb) {
      console.log('[LibraryView] Import successful, updating database');
      setGlobalWordDb(result.updatedDb);

      // 记录到已导入列表
      if (!importedLibraries.includes(libraryId)) {
        const newImportedLibraries = [...importedLibraries, libraryId];
        setImportedLibraries(newImportedLibraries);
        localStorage.setItem('imported_preset_libraries', JSON.stringify(newImportedLibraries));
      }
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
                autoComplete="off"
                name="articleInput"
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
                autoComplete="off"
                name="bulkVocabInput"
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
              <div className="flex gap-2">
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

                <button
                  onClick={handlePresetLibraryClick}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all duration-200 hover:opacity-90"
                  style={{
                    backgroundColor: `${theme.accent}33`,
                    color: theme.accent
                  }}
                  title="导入预设词库"
                >
                  <BookOpen className="w-4 h-4" />
                  预设词库
                </button>
              </div>
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
            type="search"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="搜索单词..."
            className="w-full glass-input bg-black/40 cursor-text rounded-full pl-10 pr-4 py-2 text-sm text-white placeholder:text-white/60 focus:outline-none focus:ring-2 transition-colors duration-200"
            style={{ '--tw-ring-color': theme.primary, borderColor: searchTerm ? theme.primary : undefined }}
            name="librarySearch"
            autoComplete="off"
            inputMode="search"
            enterKeyHint="search"
          />
        </div>
      </div>

      {/* 单词列表 */}
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-2"
        onScroll={handleListScroll}
      >
        {filteredWords.length === 0 ? (
          <div className="text-center text-gray-500 py-10">未找到单词</div>
        ) : (
          visibleWords.map(w => (
            <div
              key={w.id}
              onClick={() => handleWordClick(w)}
              onMouseEnter={() => handleMouseEnterWord(w)}
              onMouseLeave={handleMouseLeaveWord}
              onTouchStart={() => handleTouchStartWord(w)}
              onTouchEnd={handleTouchEndWord}
              className={`relative group flex items-center justify-between p-3 rounded-xl transition-all duration-300 ${selectionMode
                ? (selectedIds.has(w.id) ? '' : 'opacity-70')
                : 'bg-[var(--card-bg)] hover:bg-[var(--card-hover-bg)] hover:-translate-y-0.5 hover:shadow-lg'
                }`}
              style={{
                '--card-bg': selectionMode && selectedIds.has(w.id) ? `${theme.primary}33` : cardBaseColor,
                '--card-hover-bg': cardHoverColor,
                borderColor: selectionMode && selectedIds.has(w.id) ? `${theme.primary}80` : 'rgba(255,255,255,0.2)',
                borderWidth: '1px',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
              }}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                {selectionMode && (
                  <div
                    className={`w-4 h-4 rounded border flex items-center justify-center`}
                    style={{
                      borderColor: selectedIds.has(w.id) ? theme.primary : '#9ca3af',
                      backgroundColor: selectedIds.has(w.id) ? theme.primary : 'transparent'
                    }}
                  >
                    {selectedIds.has(w.id) && <CheckSquare className="w-3 h-3 text-white" />}
                  </div>
                )}

                <div className="min-w-0">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={`font-bold text-base truncate transition-colors duration-200 ${selectionMode
                        ? 'text-gray-800'
                        : 'text-[var(--text-normal)] group-hover:text-[var(--text-hover)]'
                        }`}
                      style={{
                        '--text-normal': w.gender ? pastelGenderColors[w.gender.toLowerCase()] : '#ffffff',
                        '--text-hover': w.gender ? deepGenderColors[w.gender.toLowerCase()] : '#1f2937'
                      }}
                    >
                      {w.gender && (
                        <span
                          className="text-xs opacity-90 mr-1 font-serif italic transition-colors duration-200"
                        >
                          {genderToArticle(w.gender)}
                        </span>
                      )}
                      <span className="transition-colors duration-200">
                        {w.de}
                      </span>
                    </span>

                    {/* 词典来源标识 */}
                    {w._fromDict && (
                      <div className="flex gap-1">
                        {w.source_tags && w.source_tags.length > 0 ? (
                          w.source_tags.map((tag, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 text-[10px] rounded-full font-medium uppercase tracking-wider"
                              style={{
                                backgroundColor: withOpacity(theme.accent, 0.15),
                                color: theme.accent,
                                border: `1px solid ${withOpacity(theme.accent, 0.25)}`
                              }}
                            >
                              {tag}
                            </span>
                          ))
                        ) : (
                          <span
                            className="px-1.5 py-0.5 text-[10px] rounded-full font-medium uppercase tracking-wider"
                            style={{
                              backgroundColor: withOpacity(theme.accent, 0.15),
                              color: theme.accent,
                              border: `1px solid ${withOpacity(theme.accent, 0.25)}`
                            }}
                            title="来自词典"
                          >
                            词典
                          </span>
                        )}
                      </div>
                    )}

                    {/* 简单的熟练度指示点 */}
                    <div className="flex gap-0.5">
                      {[...Array(Math.min(5, w.familiarity || 0))].map((_, i) => (
                        <div key={i} className="w-1 h-1 rounded-full bg-green-600/50"></div>
                      ))}
                    </div>
                  </div>
                  <p
                    className={`text-sm truncate transition-colors duration-200 ${selectionMode
                      ? 'text-gray-600'
                      : 'text-[var(--text-normal)] group-hover:text-[var(--text-hover)]'
                      }`}
                    style={{
                      '--text-normal': w.gender ? pastelGenderColors[w.gender.toLowerCase()] : '#d1d5db', // Fallback to light gray if no gender
                      '--text-hover': w.gender ? deepGenderColors[w.gender.toLowerCase()] : '#4b5563'   // Fallback to dark gray
                    }}
                  >
                    {w.cn}
                  </p>
                </div>
              </div>

              {/* 悬停操作按钮 (非批量模式下) */}
              {!selectionMode && (
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={(e) => { e.stopPropagation(); handleResetWord(w.id); }} className="p-2 hover:bg-black/5 rounded-full text-gray-400 hover:text-yellow-600" title="重置进度">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); handleDeleteWord(w.id); }} className="p-2 hover:bg-black/5 rounded-full text-gray-400 hover:text-red-600" title="删除">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* 例句浮窗 */}
              {hoveringId === w.id && !selectionMode && (
                <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-64 bg-white/95 backdrop-blur shadow-xl p-3 rounded-lg text-sm pointer-events-none border border-gray-100">
                  {loadingExampleId === w.id ? (
                    <span className="text-gray-500 animate-pulse">正在生成例句...</span>
                  ) : examplesById[w.id] ? (
                    <>
                      <p className="text-slate-900 font-medium mb-1">{examplesById[w.id].de}</p>
                      <p className="text-gray-600 text-xs">{examplesById[w.id].cn}</p>
                    </>
                  ) : (
                    <span className="text-gray-400">暂无例句</span>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {showCard && modalWordData && (
        <WordCardModal
          cardBgColor={focusCardBg}
          word={modalWordData}
          onClose={() => setShowCard(false)}
          onPrev={goPrev}
          onNext={goNext}
          hasPrev={hasPrev}
          hasNext={hasNext}
          currentIndex={currentIndex}
          totalCount={filteredWords.length}
        />
      )}

      {/* 预设词库选择器 */}
      {showPresetLibrary && (
        <PresetLibrarySelector
          onImport={handlePresetLibraryImport}
          onDelete={handleDeleteLibrary}
          onClose={() => setShowPresetLibrary(false)}
          importedLibraries={importedLibraries}
        />
      )}

    </div>
  );
}