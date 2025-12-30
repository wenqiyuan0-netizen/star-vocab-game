import React, { useRef, useState } from 'react';
import {
  PlusCircle, Save, Trash2, Upload, X, Search, RotateCcw, FileText, CheckSquare, Square, BookOpen
} from 'lucide-react';
import { useTheme } from '../../hooks/useTheme';
import { computeProficiency } from '../../logic/srs';
import { PresetLibrarySelector } from './PresetLibrarySelector';

export function WordManager({
  globalWordDb,
  customInput,
  setCustomInput,
  handleBulkAdd,
  selectionMode,
  setSelectionMode,
  selectedIds,
  setSelectedIds,
  handleToggleSelect,
  handleBulkDeleteRequest,
  clearSelection,
  handleMouseEnterWord,
  handleMouseLeaveWord,
  handleTouchStartWord,
  handleTouchEndWord,
  hoveringId,
  loadingExampleId,
  examplesById,
  handleDeleteWord,
  handleResetWord,
  handleExportSave,
  setShowSaveModal,
  localCorpusService,
  fileInputRef,
  getDictEntry
}) {
  const theme = useTheme();
  const [showCard, setShowCard] = useState(false);
  const [cardWord, setCardWord] = useState(null);
  const [cardEntry, setCardEntry] = useState(null);
  const [cardFlipped, setCardFlipped] = useState(false);
  const [showPresetLibrary, setShowPresetLibrary] = useState(false);

  const handleArticleUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const title = file.name;
    const content = await file.text();
    try {
      await localCorpusService.addArticle(title, content);
      alert(`文章 "${title}" 已成功添加到本地语料库！`);
    } catch (error) {
      console.error("添加文章失败:", error);
      alert(`添加文章失败: ${error.message}`);
    }
  };

  const handlePresetLibraryImport = (text, libraryName) => {
    setCustomInput(text);
    // 自动触发导入
    setTimeout(() => {
      handleBulkAdd();
      setCustomInput(''); // 清空输入框
    }, 100);
  };

  return (
    <div className="h-full flex flex-col gap-4">
      {/* 顶部工具栏 */}
      <div className="glass-panel rounded-xl p-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <FileText className="w-5 h-5" style={{ color: theme.primary }} />
            词汇库
            <span className="text-sm font-normal text-gray-300 glass-panel px-2 py-0.5 rounded-full">
              {globalWordDb.length}
            </span>
          </h2>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="file"
            accept=".txt,.md,.html"
            style={{ display: 'none' }}
            ref={fileInputRef}
            onChange={handleArticleUpload}
          />
          <button
            onClick={() => setShowPresetLibrary(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition hover:opacity-90 shadow-sm"
            style={{ backgroundColor: theme.primary, color: '#ffffff', boxShadow: `0 2px 8px ${theme.primary}33` }}
          >
            <BookOpen className="w-4 h-4" />
            预设词库
          </button>

          <button
            onClick={() => fileInputRef.current.click()}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition hover:opacity-90 shadow-sm"
            style={{ backgroundColor: theme.secondary, color: '#ffffff', boxShadow: `0 2px 8px ${theme.secondary}33` }}
          >
            <Upload className="w-4 h-4" />
            导入文章
          </button>

          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition hover:opacity-90 shadow-sm"
            style={{ backgroundColor: theme.accent, color: '#ffffff', boxShadow: `0 2px 8px ${theme.accent}33` }}
          >
            <Save className="w-4 h-4" />
            存档
          </button>

          <button
            onClick={() => setSelectionMode(!selectionMode)}
            className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition hover:opacity-90 shadow-sm ${selectionMode
                ? ''
                : ''
              }`}
            style={{ 
              backgroundColor: selectionMode ? '#ef4444' : `${theme.primary}cc`, // 选中红色退出，未选半透明主色
              color: '#ffffff',
              boxShadow: selectionMode ? '0 2px 8px rgba(239, 68, 68, 0.3)' : `0 2px 8px ${theme.primary}33`
            }}
          >
            <CheckSquare className="w-4 h-4" />
            {selectionMode ? '退出管理' : '批量管理'}
          </button>
        </div>
      </div>

      {/* 批量操作栏 (仅在管理模式显示) */}
      {selectionMode && (
        <div className="glass-panel p-3 rounded-xl flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-300 font-medium pl-2">
              已选 {selectedIds.size} 项
            </span>
            <div className="h-4 w-px bg-slate-600"></div>
            <button onClick={() => setSelectedIds(new Set(globalWordDb.map(w => w.id)))} className="text-xs hover:text-white transition-colors" style={{ color: theme.primary }}>全选</button>
            <button onClick={clearSelection} className="text-xs text-gray-400 hover:text-gray-200">清空</button>
          </div>
          <button
            onClick={handleBulkDeleteRequest}
            disabled={selectedIds.size === 0}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold bg-red-600 text-white rounded-lg hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            <Trash2 className="w-3 h-3" />
            删除选中
          </button>
        </div>
      )}

      {/* 添加新词区域 */}
      <div className="glass-panel rounded-xl p-4">
        <div className="flex gap-2">
          <textarea
            value={customInput}
            onChange={e => setCustomInput(e.target.value)}
            placeholder="快速添加: der Apfel, 苹果 (每行一个)"
            className="flex-grow glass-input text-left cursor-text rounded-lg p-3 text-sm text-gray-200 focus:ring-2 transition-colors min-h-[60px] resize-none placeholder-gray-500"
            style={{ '--tw-ring-color': `${theme.primary}80`, borderColor: theme.primary }}
          />
          <button
            onClick={handleBulkAdd}
            disabled={!customInput.trim()}
            className="flex flex-col items-center justify-center px-4 gap-1 font-semibold text-white rounded-lg hover:opacity-90 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed w-24"
            style={{ backgroundColor: theme.primary, boxShadow: `0 4px 12px ${theme.primary}33` }}
          >
            <PlusCircle className="w-6 h-6" />
            <span className="text-xs">添加</span>
          </button>
        </div>
      </div>

      {/* 单词列表区域 (自适应剩余高度) */}
      <div className="flex-grow overflow-hidden glass-panel rounded-xl relative">
        <div className="absolute inset-0 overflow-y-auto p-2 custom-scrollbar">
          {globalWordDb.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 gap-2">
              <Search className="w-8 h-8 opacity-50" />
              <p>词库空空如也，试着添加一些单词吧</p>
            </div>
          ) : (
            <ul className="space-y-2 pb-20">
              {[...globalWordDb]
                .sort((a, b) => {
                  const pa = typeof a.proficiency === 'number' ? a.proficiency : computeProficiency(a);
                  const pb = typeof b.proficiency === 'number' ? b.proficiency : computeProficiency(b);
                  const ga = a.graduated ? 1 : 0;
                  const gb = b.graduated ? 1 : 0;
                  if (ga !== gb) return ga - gb;
                  return pa - pb;
                })
                .map(w => (
                <li
                  key={w.id}
                  onClick={() => selectionMode && handleToggleSelect(w.id)}
                  onDoubleClick={async () => {
                    if (selectionMode) return;
                    setShowCard(true);
                    setCardWord(w);
                    setCardFlipped(false);
                    let entry = null;
                    try {
                      if (typeof getDictEntry === 'function') {
                        entry = await getDictEntry(w.de, w.gender);
                      }
                    } catch { }
                    setCardEntry(entry);
                  }}
                  onMouseEnter={() => handleMouseEnterWord(w)}
                  onMouseLeave={handleMouseLeaveWord}
                  onTouchStart={() => handleTouchStartWord(w)}
                  onTouchEnd={handleTouchEndWord}
                  className={`relative flex items-center justify-between p-3 rounded-lg transition-all duration-200 group border border-transparent
                    ${selectionMode ? 'cursor-pointer' : ''} 
                    ${selectedIds.has(w.id) ? '' : 'glass-panel hover:bg-white/5'}
                  `}
                  style={selectedIds.has(w.id) ? {
                    backgroundColor: `${theme.primary}33`,
                    borderColor: `${theme.primary}80`
                  } : {}}
                >
                  <div className="flex items-center gap-3 overflow-hidden">
                    {selectionMode && (
                      <div
                        className={`flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors ${selectedIds.has(w.id) ? 'text-white' : 'bg-slate-700 text-transparent'}`}
                        style={selectedIds.has(w.id) ? { backgroundColor: theme.primary } : {}}
                      >
                        <CheckSquare className="w-3.5 h-3.5" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <div className="flex items-baseline gap-2">
                        <span className="font-bold text-white truncate">{w.gender ? `${w.gender} ${w.de}` : w.de}</span>
                      </div>
                      <div className="text-sm text-gray-400 truncate">{w.cn}</div>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="relative w-24 h-2 bg-slate-700 rounded-full overflow-hidden">
                          <div className="h-2 rounded-full" style={{ width: `${Math.min(100, Math.round((w.proficiency ?? computeProficiency(w))))}%`, backgroundColor: theme.primary }} />
                        </div>
                        {w.graduated && (
                          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ backgroundColor: `${theme.secondary}33`, color: theme.secondary }}>
                            毕业
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 悬停例句弹窗 */}
                  {hoveringId === w.id && !selectionMode && (
                    <div className="absolute left-0 top-full mt-2 w-full max-w-md glass-panel p-4 text-sm shadow-2xl z-50 animate-in fade-in slide-in-from-top-2 pointer-events-none">
                      {loadingExampleId === w.id ? (
                        <div className="flex items-center gap-2" style={{ color: theme.primary }}>
                          <div className="w-2 h-2 rounded-full animate-ping" style={{ backgroundColor: theme.primary }} />
                          正在智能生成例句...
                        </div>
                      ) : examplesById[w.id] ? (
                        <div className="space-y-2">
                          <p className="font-medium text-white text-base leading-relaxed">{examplesById[w.id].de}</p>
                          <p className="text-gray-400">{examplesById[w.id].cn}</p>
                        </div>
                      ) : (
                        <span className="text-gray-500">暂无例句</span>
                      )}
                    </div>
                  )}

                  {/* 单个操作按钮 (非批量模式下显示) */}
                  {!selectionMode && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity bg-transparent rounded-lg px-1 ml-2">
                      <button onClick={(e) => { e.stopPropagation(); handleResetWord(w.id); }} title="重置学习进度" className="p-2 text-gray-400 hover:text-yellow-400 transition"><RotateCcw className="w-4 h-4" /></button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteWord(w.id); }} title="删除" className="p-2 text-gray-400 hover:text-red-400 transition"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {showPresetLibrary && (
        <PresetLibrarySelector
          onImport={handlePresetLibraryImport}
          onClose={() => setShowPresetLibrary(false)}
        />
      )}

      {showCard && cardWord && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white w-full max-w-sm rounded-3xl p-5 shadow-2xl relative">
            <button
              onClick={() => setShowCard(false)}
              className="absolute top-3 right-3 p-2 text-gray-400 hover:text-gray-600"
            >
              <X className="w-4 h-4" />
            </button>
            <div
              onClick={() => setCardFlipped(v => !v)}
              className={`cursor-pointer border rounded-2xl p-4 ${cardFlipped ? 'bg-slate-100' : 'glass-panel'}`}
              style={{ borderColor: `${theme.primary}33` }}
            >
              {!cardFlipped ? (
                <div className="space-y-1">
                  <div className="text-xl font-bold text-slate-900">
                    {cardEntry && cardEntry.headword ? cardEntry.headword : (cardWord.gender ? `${cardWord.gender} ${cardWord.de}` : cardWord.de)}
                  </div>
                  {cardEntry && cardEntry.plural ? (
                    <div className="text-xs text-slate-500">复数 {cardEntry.plural}</div>
                  ) : null}
                  <div className="text-[11px] text-slate-500">{(cardEntry && cardEntry.pos) || (cardWord.pos || '')}</div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-base font-semibold text-slate-900">{cardWord.cn || '暂无释义'}</div>
                  {cardEntry && Array.isArray(cardEntry.examples) && cardEntry.examples.length > 0 ? (
                    <div className="text-sm text-slate-800">
                      {cardEntry.examples[0].de}
                      {cardEntry.examples[0].cn ? (
                        <div className="text-xs text-slate-500 mt-1">{cardEntry.examples[0].cn}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="text-xs text-slate-500">暂无例句</div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
