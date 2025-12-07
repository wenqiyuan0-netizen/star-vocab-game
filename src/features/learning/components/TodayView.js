import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Upload, Save, Trash2, Filter, Sparkles, ChevronLeft, ChevronRight, Minimize2, Maximize2 } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { withOpacity, getBrightestVariant } from '../../../utils/colorUtils';
import { DeckGenerator } from '../services/DeckGenerator';
import { generateGenderColors } from '../../../utils/colorUtils';
import { WordCardModal, FrontFace, BackFace } from '../../vocabulary/components/WordCard';

const genderToArticle = g => {
  if (!g) return '';
  const x = String(g).toLowerCase();
  if (x === 'm') return 'der';
  if (x === 'f') return 'die';
  if (x === 'n') return 'das';
  if (x === 'der' || x === 'die' || x === 'das') return x;
  return '';
};

// Shuffle helper
const shuffleArray = (array) => {
  const newArr = [...array];
  for (let i = newArr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArr[i], newArr[j]] = [newArr[j], newArr[i]];
  }
  return newArr;
};

export function TodayView(props) {
  const theme = useTheme();
  const genderColors = useMemo(() => generateGenderColors(theme), [theme]);
  
  // Fix: Use theme.primary (dominant color) instead of theme.background
  // Fix: Tint towards white (0.9 mix factor means 90% white, 10% color)
  const cardBgColor = useMemo(() => getBrightestVariant(theme.primary, 0.9), [theme.primary]);

  const [showImport, setShowImport] = useState(false);
  const [dictRaw, setDictRaw] = useState('');
  const [dictList, setDictList] = useState([]);
  const [onlyMatched, setOnlyMatched] = useState(false);
  const [flippedIds, setFlippedIds] = useState(new Set());
  const fileInputRef = useRef(null);

  // Focus Mode State
  const [viewMode, setViewMode] = useState('focus'); // 'focus' | 'grid'
  const [focusIndex, setFocusIndex] = useState(0);

  const normalizeBase = s => (s || '').trim().toLowerCase().replace(/^(der|die|das)\s+/, '');

  const globalWordDb = (props && Array.isArray(props.globalWordDb)) ? props.globalWordDb : [];
  
  const [deckMode, setDeckMode] = useState('normal');
  
  const effectiveDeck = useMemo(() => {
    if (!globalWordDb || globalWordDb.length === 0) return [];
    const { deck, mode } = DeckGenerator.getOrGeneratePlan(globalWordDb, props.settingsState);
    setDeckMode(mode);
    return deck;
  }, [globalWordDb, props.settingsState]);

  // Pseudo-random sequence for Focus Mode
  const playSequence = useMemo(() => {
    const indices = effectiveDeck.map((_, i) => i);
    return shuffleArray(indices);
  }, [effectiveDeck]);

  // Reset focus state when deck changes
  useEffect(() => {
    setFocusIndex(0);
    setViewMode('focus'); // Auto-enter focus mode on new deck
  }, [effectiveDeck]);

  useEffect(() => {
    const stored = localStorage.getItem('star_vocab_local_dict');
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        const arr = Array.isArray(parsed) ? parsed : [parsed];
        setDictList(arr.filter(Boolean));
      } catch {}
    }
  }, []);

  useEffect(() => {
    if (dictList.length > 0) return;
    let cancelled = false;
    fetch('/vocab-dict.json')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (cancelled || !data) return;
        const arr = Array.isArray(data) ? data : [data];
        localStorage.setItem('star_vocab_local_dict', JSON.stringify(arr));
        setDictList(arr.filter(Boolean));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [dictList.length]);

  const dictIndex = useMemo(() => {
    const m = new Map();
    dictList.forEach(e => {
      const base = e.base || e.word || (e.headword ? e.headword.replace(/^(der|die|das)\s+/, '') : '');
      const key = normalizeBase(base);
      if (key && !m.has(key)) m.set(key, e);
    });
    return m;
  }, [dictList]);

  const cards = useMemo(() => {
    return effectiveDeck.map(w => {
      const key = normalizeBase(w.de);
      const entry = dictIndex.get(key);
      return { w, entry };
    });
  }, [effectiveDeck, dictIndex]);

  const matchedCount = useMemo(() => cards.filter(c => !!c.entry).length, [cards]);
  const visibleCards = useMemo(() => (onlyMatched ? cards.filter(c => !!c.entry) : cards), [cards, onlyMatched]);

  const toggleFlip = id => {
    setFlippedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCardDoubleClick = (w) => {
      // Find where this card is in the shuffled sequence to continue from there
      const idx = effectiveDeck.findIndex(x => x.id === w.id);
      if (idx === -1) return;
      
      // Find this 'real index' in the 'shuffled sequence'
      const seqIndex = playSequence.indexOf(idx);
      if (seqIndex !== -1) {
          setFocusIndex(seqIndex);
      } else {
          setFocusIndex(0);
      }
      setViewMode('focus');
  };

  const handleFocusNext = (e) => {
      e && e.stopPropagation && e.stopPropagation();
      if (focusIndex < playSequence.length - 1) {
          setFocusIndex(prev => prev + 1);
      }
  };

  const handleFocusPrev = (e) => {
      e && e.stopPropagation && e.stopPropagation();
      if (focusIndex > 0) {
          setFocusIndex(prev => prev - 1);
      }
  };

  const saveDict = () => {
    try {
      const parsed = JSON.parse(dictRaw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      localStorage.setItem('star_vocab_local_dict', JSON.stringify(arr));
      setDictList(arr.filter(Boolean));
      setShowImport(false);
    } catch {}
  };

  const clearDict = () => {
    localStorage.removeItem('star_vocab_local_dict');
    setDictList([]);
    setDictRaw('');
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      localStorage.setItem('star_vocab_local_dict', JSON.stringify(arr));
      setDictList(arr.filter(Boolean));
      setShowImport(false);
    } catch {}
    e.target.value = '';
  };

  // Focus Card Render Logic
  const currentFocusCard = useMemo(() => {
      if (playSequence.length === 0) return null;
      const realIndex = playSequence[focusIndex];
      if (realIndex === undefined) return null;
      const w = effectiveDeck[realIndex];
      if (!w) return null;
      const key = normalizeBase(w.de);
      const entry = dictIndex.get(key);
      return { w, entry };
  }, [playSequence, focusIndex, effectiveDeck, dictIndex]);

  return (
    <div className="h-full flex flex-col gap-4 p-4 relative">
      {/* Focus Mode Overlay */}
      {viewMode === 'focus' && currentFocusCard ? (
          <WordCardModal
             word={currentFocusCard}
             onClose={() => setViewMode('grid')}
             onPrev={handleFocusPrev}
             onNext={handleFocusNext}
             hasPrev={focusIndex > 0}
             hasNext={focusIndex < playSequence.length - 1}
             currentIndex={focusIndex}
             totalCount={playSequence.length}
             cardBgColor={cardBgColor}
          />
      ) : (
        <>
          <div className="glass-panel rounded-xl p-4 flex items-center justify之间">
        <div className="flex items-center gap-3">
          <span className="font-bold text-lg" style={{ color: theme.text }}>今日词卡</span>
          {deckMode === 'bonus' && (
             <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1"
               style={{
                 backgroundColor: cardBgColor,
                 color: theme.text,
                 border: `1px solid ${withOpacity(theme.primary, 0.2)}`
               }}
             >
               <Sparkles className="w-3 h-3" />
               奖赏模式 (额外练习)
             </span>
          )}
          <span className="text-xs px-2 py-0.5 rounded-full"
            style={{
              backgroundColor: withOpacity(Array.isArray(theme.analogous) && theme.analogous[0] ? theme.analogous[0] : theme.secondary, 0.25),
              color: withOpacity(theme.text, 0.85),
              border: `1px solid ${withOpacity(Array.isArray(theme.contrast) && theme.contrast[0] ? theme.contrast[0] : theme.primary, 0.25)}`
            }}
          >{effectiveDeck.length}</span>
        </div>
        <div className="flex items-center gap-2">
        </div>
      </div>

      {showImport && (
        <div className="glass-panel rounded-xl p-4 animate-fade-in">
          <div className="text-sm text-gray-300 mb-2">支持对象或数组格式，示例字段含 headword/base/pos/article/gender/plural/examples</div>
          <textarea
            value={dictRaw}
            onChange={e => setDictRaw(e.target.value)}
            placeholder='粘贴 JSON，如 [{"id":"abfall-001","headword":"der Abfall","base":"Abfall","pos":"noun","article":"der","gender":"m","plural":"Abfälle","examples":[{"de":"...","cn":"..."}]}]'
            className="w-full min-h-[120px] glass-button text-left rounded-lg p-3 text-sm text-gray-200 focus:ring-2 transition-all resize-y placeholder-gray-500"
            style={{ '--tw-ring-color': withOpacity(theme.primary, 0.5), borderColor: theme.primary }}
          />
          <div className="mt-3 flex items-center gap-2">
            <button
              onClick={saveDict}
              disabled={!dictRaw.trim()}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition border glass-button hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: withOpacity(theme.primary, 0.2), color: theme.primary, borderColor: withOpacity(theme.primary, 0.3) }}
            >
              <Save className="w-4 h-4" />
              保存词典
            </button>
            <button
              onClick={clearDict}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg transition border glass-button hover:bg-white/10"
              style={{ backgroundColor: `${theme.accent}33`, color: theme.accent, borderColor: `${theme.accent}4d` }}
            >
              <Trash2 className="w-4 h-4" />
              清空词典
            </button>
          </div>
        </div>
      )}

      {effectiveDeck.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-gray-300">今日暂无卡池，请在“主页”开始游戏生成卡池</div>
      ) : (
        <div className="flex-1 overflow-hidden glass-panel rounded-xl relative">
          <div className="absolute inset-0 overflow-y-auto p-3 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleCards.map(({ w, entry }) => {
                const flipped = flippedIds.has(w.id);
                return (
                  <div
                    key={w.id}
                    onClick={() => toggleFlip(w.id)}
                    className={`p-4 rounded-2xl transition-all border cursor-pointer`}
                    style={{
                      borderColor: withOpacity(theme.primary, 0.2),
                      minHeight: '200px',
                      backgroundColor: withOpacity(cardBgColor, 1),
                      isolation: 'isolate'
                    }}
                  >
                    <div className="relative h-full flex flex-col">
                      <div className="flex-1 pb-8">
                        {flipped ? <BackFace w={w} entry={entry} genderColors={genderColors} /> : <FrontFace w={w} entry={entry} genderColors={genderColors} />}
                      </div>
                      
                      {/* 放大按钮 - 位于中下部（字幕区） */}
                      <div className="absolute bottom-0 left-0 right-0 flex justify-center pb-1 pointer-events-none">
                         <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCardDoubleClick(w);
                          }}
                          className="pointer-events-auto flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full border transition-all hover:bg-white/20 hover:shadow-lg group active:scale-95 backdrop-blur-md"
                          style={{
                            backgroundColor: withOpacity(theme.primary, 0.2),
                            color: withOpacity(theme.text, 0.95),
                            borderColor: withOpacity(theme.primary, 0.3),
                            boxShadow: `0 4px 12px ${withOpacity(theme.primary, 0.15)}`
                          }}
                          title="放大查看"
                        >
                          <svg className="w-3.5 h-3.5 transition-transform group-hover:scale-110" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                          </svg>
                          <span>放大</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
