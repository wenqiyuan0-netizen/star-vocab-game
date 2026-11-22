import React, { useEffect, useMemo, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { useFocusNavigation } from '../../../shared/hooks/useFocusNavigation';
import { withOpacity, getBrightestVariant, mixColors } from '../../../utils/colorUtils';
import { DeckGenerator } from '../services/DeckGenerator';
import { generateGenderColors } from '../../../utils/colorUtils';
import { WordCardModal, FrontFace, BackFace } from '../../vocabulary/components/WordCard';
import { unifiedDictService } from '../../../shared/services/dictionary/UnifiedDictionaryService';
import { soundManager } from '../../../shared/services/audio/SoundManager';

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
  
  const cardBgColor = useMemo(() => getBrightestVariant(theme.primary, 0.9), [theme.primary]);

  const [dictEntriesMap, setDictEntriesMap] = useState(new Map()); // 新增：按需加载的词条
  const [onlyMatched, setOnlyMatched] = useState(false);
  const [flippedIds, setFlippedIds] = useState(new Set());

  // Focus Mode State
  const [viewMode, setViewMode] = useState('focus'); // 'focus' | 'grid'
  
  const normalizeBase = s => (s || '').trim().toLowerCase().replace(/^(der|die|das)\s+/, '');

  const globalWordDb = (props && Array.isArray(props.globalWordDb)) ? props.globalWordDb : [];
  
  // Calculate deck and mode together to avoid side effects in useMemo
  const { deck: effectiveDeck, mode: deckMode } = useMemo(() => {
    if (!globalWordDb || globalWordDb.length === 0) return { deck: [], mode: 'normal' };
    return DeckGenerator.getOrGeneratePlan(globalWordDb, props.settingsState);
  }, [globalWordDb, props.settingsState]);

  // Pseudo-random sequence for Focus Mode
  const playSequence = useMemo(() => {
    const indices = effectiveDeck.map((_, i) => i);
    return shuffleArray(indices);
  }, [effectiveDeck]);

  const { 
    currentIndex: focusIndex, 
    setCurrentIndex: setFocusIndex, 
    goNext: handleFocusNext, 
    goPrev: handleFocusPrev,
    hasNext: hasFocusNext,
    hasPrev: hasFocusPrev
  } = useFocusNavigation(playSequence.length);

  // Reset focus state when deck changes
  useEffect(() => {
    if (effectiveDeck.length > 0) {
      setFocusIndex(0);
      setViewMode('focus'); // Auto-enter focus mode on new deck
    }
  }, [effectiveDeck]);

  // 新逻辑：当 deck 变化时，异步加载其中单词的词典详情
  useEffect(() => {
    let active = true;
    const loadDefinitions = async () => {
        const newMap = new Map();
        // 并行查询所有单词
        const promises = effectiveDeck.map(async (w) => {
            try {
                const entry = await unifiedDictService.lookup(w.de);
                if (entry && active) {
                    newMap.set(normalizeBase(w.de), entry);
                }
            } catch (e) {
                // ignore
            }
        });
        
        await Promise.all(promises);
        if (active) {
            setDictEntriesMap(newMap);
        }
    };
    
    if (effectiveDeck.length > 0) {
        loadDefinitions();
    }
    
    return () => { active = false; };
  }, [effectiveDeck]);

  // 移除旧的 useEffect (L73-L97)

  // 移除 dictIndex useMemo (L99-L107)

  const cards = useMemo(() => {
    return effectiveDeck.map(w => {
      const key = normalizeBase(w.de);
      const entry = dictEntriesMap.get(key); // 从新 Map 获取
      return { w, entry };
    });
  }, [effectiveDeck, dictEntriesMap]);


  const matchedCount = useMemo(() => cards.filter(c => !!c.entry).length, [cards]);
  const visibleCards = useMemo(() => (onlyMatched ? cards.filter(c => !!c.entry) : cards), [cards, onlyMatched]);

  const toggleFlip = id => {
    soundManager.playFlip();
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

  // Focus Card Render Logic
  const currentFocusCard = useMemo(() => {
      if (playSequence.length === 0) return null;
      const realIndex = playSequence[focusIndex];
      if (realIndex === undefined) return null;
      const w = effectiveDeck[realIndex];
      if (!w) return null;
      const key = normalizeBase(w.de);
      const entry = dictEntriesMap.get(key);
      return { w, entry };
  }, [playSequence, focusIndex, effectiveDeck, dictEntriesMap]);

  // Calculate dynamic background for Focus Mode
  const focusCardBg = useMemo(() => {
    if (!currentFocusCard) return cardBgColor;
    const g = currentFocusCard.w.gender;
    const gc = g ? genderColors[g.toLowerCase()] : null;
    return gc ? mixColors(cardBgColor, gc, 0.15) : cardBgColor;
  }, [currentFocusCard, cardBgColor, genderColors]);

  return (
    <div className="h-full flex flex-col gap-4 p-4 relative">
      {/* Focus Mode Overlay */}
      {viewMode === 'focus' && currentFocusCard ? (
          <WordCardModal
             word={currentFocusCard}
             onClose={() => setViewMode('grid')}
             onPrev={handleFocusPrev}
             onNext={handleFocusNext}
             hasPrev={hasFocusPrev}
             hasNext={hasFocusNext}
             currentIndex={focusIndex}
             totalCount={playSequence.length}
             cardBgColor={focusCardBg}
          />
      ) : (
        <>
          <div className="glass-panel rounded-xl p-4 flex items-center justify-between">
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

      {effectiveDeck.length === 0 ? (
        <div className="glass-panel rounded-xl p-8 text-center text-gray-300">今日暂无卡池，请在“主页”开始游戏生成卡池</div>
      ) : (
        <div className="flex-1 overflow-hidden glass-panel rounded-xl relative">
          <div className="absolute inset-0 overflow-y-auto p-3 custom-scrollbar">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visibleCards.map(({ w, entry }) => {
                const flipped = flippedIds.has(w.id);
                const gColor = w.gender ? genderColors[w.gender.toLowerCase()] : null;
                const finalBg = gColor ? mixColors(cardBgColor, gColor, 0.15) : cardBgColor;
                
                return (
                  <div
                    key={w.id}
                    onClick={() => toggleFlip(w.id)}
                    className={`p-4 rounded-2xl transition-all border cursor-pointer`}
                    style={{
                      borderColor: withOpacity(theme.primary, 0.2),
                      minHeight: '200px',
                      backgroundColor: withOpacity(finalBg, 1),
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
