import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Minimize2, Sparkles } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { generateGenderColors, withOpacity, getContrastColorFromTheme } from '../../../utils/colorUtils';
import { aiService } from '../../../shared/services/ai/AIService';
import { useSupabaseProfile } from '../../../shared/hooks/useSupabase/useSupabaseProfile';

const genderToArticle = g => {
  if (!g) return '';
  const x = String(g).toLowerCase();
  if (x === 'm') return 'der';
  if (x === 'f') return 'die';
  if (x === 'n') return 'das';
  if (x === 'der' || x === 'die' || x === 'das') return x;
  return '';
};

export const FrontFace = ({ w, entry, genderColors, isFocus }) => {
  const theme = useTheme();
  const entryArticle = entry && (entry.article || (entry.gender ? genderToArticle(entry.gender) : ''));
  const entryBase = entry && (entry.base || entry.word || (entry.headword ? entry.headword.replace(/^(der|die|das)\s+/, '') : ''));
  const head = entry ? (entry.headword || (entryArticle ? `${entryArticle} ${entryBase}` : entryBase)) : (() => {
    const art = genderToArticle(w.gender);
    return art ? `${art} ${w.de}` : w.de;
  })();
  const plural = entry && (entry.plural || entry.pluralForm) ? (entry.plural || entry.pluralForm) : null;
  const pos = entry && (entry.pos || entry.partOfSpeech || entry.wordType) ? (entry.pos || entry.partOfSpeech || entry.wordType) : (w.pos || '');
  
  // Extract article for coloring if present at start
  const parts = head.split(' ');
  const hasArticle = ['der', 'die', 'das'].includes(parts[0].toLowerCase());
  
  // Use passed genderColors if available, otherwise fallback to theme variables
  const articleColor = (art) => {
      const a = (art || '').toLowerCase();
      if (Array.isArray(theme.mid) && theme.mid.length >= 3) {
        if (a === 'der') return theme.mid[0];
        if (a === 'die') return theme.mid[1];
        if (a === 'das') return theme.mid[2];
      }
      if (genderColors && genderColors[a]) return genderColors[a];
      if (a === 'der') return theme.primary;
      if (a === 'die') return theme.accent;
      if (a === 'das') return theme.secondary;
      return theme.secondary;
  };
  
  return (
    <div className={`flex flex-col items-center justify-center h-full text-center w-full ${isFocus ? 'gap-6' : 'gap-2'}`}>
      <div 
        className={`font-bold transition-all duration-500 ${isFocus ? 'text-5xl tracking-wide drop-shadow-sm' : 'text-lg'} break-words hyphens-auto max-w-full px-4`}
        style={{ color: theme.text }}
        lang="de"
      >
        {hasArticle ? (
           <span>
             <span className={isFocus ? 'font-serif italic mr-2 opacity-90' : 'font-serif italic mr-1'} style={{ color: articleColor(parts[0]) }}>{parts[0]}</span>
             <span className={isFocus ? '' : 'ml-1'}>{parts.slice(1).join(' ')}</span>
           </span>
        ) : head}
      </div>
      
      {isFocus && (
        <div className="w-12 h-1 rounded-full my-2" style={{ backgroundColor: withOpacity(theme.secondary, 0.3) }}></div>
      )}

      {plural ? <div 
          className={`${isFocus ? 'text-xl font-light tracking-wider font-serif' : 'text-sm'}`}
          style={{ color: isFocus ? withOpacity(theme.text, 0.6) : withOpacity(theme.secondary, 0.8) }}
      >
          {isFocus ? <span className="italic opacity-80">pl. {plural}</span> : <span className="font-medium">复数: {plural}</span>}
      </div> : null}
      
      {pos ? <div 
          className={`${isFocus ? 'text-sm px-4 py-1.5 rounded-full border uppercase tracking-widest' : 'text-xs px-2 py-0.5 rounded-full border'}`}
          style={isFocus ? {
              backgroundColor: withOpacity(theme.primary, 0.12),
              color: theme.text,
              borderColor: withOpacity(theme.primary, 0.25)
          } : {
              backgroundColor: withOpacity(theme.primary, 0.15),
              color: theme.text,
              borderColor: withOpacity(theme.primary, 0.3)
          }}
      >
          {pos}
      </div> : null}
    </div>
  );
};

export const BackFace = ({ w, entry, genderColors, exampleBgColor, isFocus }) => {
  const theme = useTheme();
  const [showAllExamples, setShowAllExamples] = useState(false);
  const [aiExample, setAiExample] = useState(null);
  const [loadingAi, setLoadingAi] = useState(false);
  const [aiError, setAiError] = useState(null);
  const { profile } = useSupabaseProfile();

  const handleGenerateExample = async (e) => {
    e.stopPropagation();
    setLoadingAi(true);
    setAiError(null);
    try {
      const result = await aiService.generateExample(w.de, w.cn);
      if (result) {
        setAiExample({
          sentence: result.de,
          translation: result.cn
        });
      }
    } catch (err) {
      console.error("AI Gen Error:", err);
      setAiError(err.message);
    } finally {
      setLoadingAi(false);
    }
  };
  
  // Helpers for colors
  const getArticleColor = (art) => {
      const a = (art || '').toLowerCase();
      if (genderColors && genderColors[a]) return genderColors[a];

      if (a === 'der') return theme.primary;
      if (a === 'die') return theme.accent;
      if (a === 'das') return theme.secondary;
      return theme.secondary;
  };

  // Data extraction
  const examples = entry && Array.isArray(entry.examples) ? entry.examples : [];
  const displayExamples = showAllExamples ? examples : examples.slice(0, isFocus ? 5 : 3); 
  
  const article = entry?.article || genderToArticle(entry?.gender || w.gender);
  const headword = entry?.base || entry?.word || (entry?.headword ? entry.headword.replace(/^(der|die|das)\s+/, '') : w.de);
  const pos = entry?.pos || entry?.partOfSpeech || w.pos;
  const plural = entry?.plural || entry?.pluralForm;
  const conjugations = entry?.conjugations || entry?.conjugation;

  // Styles based on theme
  const labelStyle = {
      color: withOpacity(theme.text, 0.5),
      fontSize: '0.65rem',
      letterSpacing: '0.1em',
      textTransform: 'uppercase',
      fontWeight: '700'
  };

  const dividerStyle = {
      borderColor: withOpacity(theme.primary, 0.15)
  };

  return (
      <div className={`flex flex-col h-full text-left w-full ${isFocus ? 'gap-5 p-4' : 'gap-2'}`}> 
          {/* Header: Article + Word + POS */}
          <div className={`flex flex-col gap-2 border-b ${isFocus ? 'pb-4' : 'pb-2'}`} style={dividerStyle}>
               <div className="flex items-baseline gap-3 flex-wrap">
                   {article && (
                       <span 
                           className={`${isFocus ? 'text-4xl mr-2' : 'text-lg mr-1'} font-serif italic font-bold transition-colors`} 
                           style={{ color: getArticleColor(article) }}
                       >
                           {article}
                       </span>
                   )}
                  <span 
                      className={`${isFocus ? 'text-4xl' : 'text-lg'} font-bold tracking-tight break-words hyphens-auto`}
                      style={{ color: theme.text }}
                      lang="de"
                  >
                       {headword}
                   </span>
               </div>
               
               <div className="flex items-center justify-between mt-2">
                   {pos && (
                       <span 
                           className={`${isFocus ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-0.5'} rounded-full border uppercase tracking-wider`}
                           style={{ 
                               backgroundColor: withOpacity(theme.primary, 0.12), 
                               color: theme.text,
                               borderColor: withOpacity(theme.primary, 0.25)
                           }}
                       >
                           {pos}
                       </span>
                   )}
               </div>
          </div>

          {/* Definition */}
          <div 
              className={`${isFocus ? 'text-2xl py-3' : 'text-base'} font-medium leading-relaxed`}
              style={{ color: isFocus ? theme.text : withOpacity(theme.text, 0.95) }}
          >
              {w.cn || entry?.cn || entry?.translation || '暂无释义'}
          </div>

          {/* Plural & Conjugation - Compact View */}
          {(plural || conjugations) && (
              <div 
                className={`flex flex-col gap-3 ${isFocus ? 'py-3 px-4 rounded-xl' : 'py-2 px-3 rounded-lg'} border`}
                style={{ 
                    backgroundColor: withOpacity(theme.primary, 0.08),
                    borderColor: withOpacity(theme.primary, 0.2),
                    boxShadow: `inset 0 1px 0 ${withOpacity(theme.primary, 0.1)}`
                }}
              >
                  {plural && (
                      <div className="flex items-center gap-4">
                          <span style={isFocus ? {...labelStyle, color: withOpacity(theme.text, 0.6)} : labelStyle} className="w-16 flex-shrink-0 font-medium">复数</span>
                          <span className="font-mono text-sm" style={{ color: isFocus ? withOpacity(theme.text, 0.9) : withOpacity(theme.text, 0.9) }}>{plural}</span>
                      </div>
                  )}
                  {conjugations && (
                      <div className="flex items-start gap-4">
                          <span style={isFocus ? {...labelStyle, color: withOpacity(theme.text, 0.6)} : labelStyle} className="w-16 flex-shrink-0 mt-0.5 font-medium">变位</span>
                          <span className="font-mono text-sm italic" style={{ color: isFocus ? withOpacity(theme.text, 0.9) : withOpacity(theme.text, 0.8) }}>
                              {typeof conjugations === 'string' ? conjugations : JSON.stringify(conjugations)}
                          </span> 
                      </div>
                  )}
              </div>
          )}

          {/* Examples */}
          {examples.length > 0 && (
              <div className="flex flex-col gap-2 mt-1 flex-1 min-h-0">
                  <div className="flex items-center justify-between mb-1">
                      <span style={isFocus ? {...labelStyle, color: withOpacity(theme.text, 0.6)} : labelStyle} className="font-medium">示例</span>
                      {isFocus && (
                        <button 
                          onClick={handleGenerateExample}
                          disabled={loadingAi || (profile?.level || 0) < 5}
                          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${loadingAi ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                          style={{
                            backgroundColor: (profile?.level || 0) < 5 ? withOpacity(theme.text, 0.1) : withOpacity(theme.accent, 0.15),
                            color: (profile?.level || 0) < 5 ? withOpacity(theme.text, 0.4) : theme.accent,
                            border: `1px solid ${(profile?.level || 0) < 5 ? 'transparent' : withOpacity(theme.accent, 0.3)}`
                          }}
                          title={(profile?.level || 0) < 5 ? "需要达到 Lv.5 解锁 AI 造句" : "AI 生成例句"}
                        >
                          <Sparkles className="w-3 h-3" />
                          {loadingAi ? '生成中...' : 'AI 造句'}
                        </button>
                      )}
                  </div>
                  
                  <div className="overflow-y-auto custom-scrollbar pr-2 space-y-3 flex-1">
                    {/* AI Generated Example Display */}
                    {aiExample && (
                        <div 
                            className="relative pl-4 border-l-2 mb-3 animate-fade-in"
                            style={{ borderColor: theme.accent }}
                        >
                            <div 
                                className="leading-relaxed font-serif tracking-wide mb-1 font-medium"
                                style={{ 
                                    color: theme.text,
                                    fontSize: isFocus ? '1.1rem' : '0.9rem'
                                }}
                            >
                                {aiExample.sentence}
                            </div>
                            <div 
                                className="text-xs font-light"
                                style={{ color: withOpacity(theme.text, 0.8) }}
                            >
                                {aiExample.translation}
                            </div>
                            <div className="text-[0.6rem] mt-1 opacity-50 uppercase tracking-widest" style={{ color: theme.accent }}>AI Generated</div>
                        </div>
                    )}

                    {aiError && (
                      <div className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 mb-2 border border-red-100">
                        {aiError}
                      </div>
                    )}

                    {displayExamples.map((ex, i) => (
                        <div 
                            key={i} 
                            className="relative pl-4 border-l-2 transition-all duration-300 group hover:border-l-3"
                            style={{ borderColor: withOpacity(theme.primary, 0.4) }}
                        >
                            <div 
                                className="leading-relaxed font-serif tracking-wide mb-1"
                                style={{ 
                                    color: isFocus ? theme.text : withOpacity(theme.text, 0.95),
                                    fontSize: isFocus ? '1.1rem' : '0.9rem'
                                }}
                            >
                                {ex.de || ex.sentence}
                            </div>
                            {(ex.cn || ex.translation) && (
                                <div 
                                    className="text-xs font-light"
                                    style={{ color: isFocus ? withOpacity(theme.text, 0.6) : withOpacity(theme.text, 0.7) }}
                                >
                                    {ex.cn || ex.translation}
                                </div>
                            )}
                        </div>
                    ))}
                  </div>
                  
                  {examples.length > (isFocus ? 5 : 3) && (
                      <button 
                          onClick={(e) => {
                              e.stopPropagation();
                              setShowAllExamples(!showAllExamples);
                          }}
                          className="text-xs self-start mt-1 hover:underline"
                          style={{ color: theme.secondary }}
                      >
                          {showAllExamples ? '收起' : `+${examples.length - (isFocus ? 5 : 3)} 更多`}
                      </button>
                  )}
              </div>
          )}
      </div>
  );
};

export const WordCardModal = ({
    word, // { w, entry }
    onClose,
    onPrev,
    onNext,
    hasPrev,
    hasNext,
    currentIndex,
    totalCount,
    showNavigation = true,
    cardBgColor: propCardBgColor
}) => {
    const theme = useTheme();
    
    // Use theme variables directly for consistent coloring
    const genderColors = useMemo(() => generateGenderColors(theme), [theme]);
    // Use glass style for the card background, default if not passed
    const cardBgColor = useMemo(() => propCardBgColor || withOpacity(theme.background, 0.65), [theme.background, propCardBgColor]);

    const [flipped, setFlipped] = useState(false);

    // Reset flip state when word changes
    useEffect(() => {
        setFlipped(false);
    }, [word?.w?.id]);

    if (!word) return null;

    return (
        <div 
            className="absolute inset-0 z-50 flex flex-col items-center justify-center animate-fade-in"
            onClick={onClose}
            style={{
              backgroundColor: 'transparent'
            }}
        >
             <div 
                className="w-full max-w-md aspect-[3/4] rounded-3xl shadow-2xl relative transition-all duration-500 transform hover:scale-[1.01] overflow-hidden group"
                onClick={(e) => {
                    e.stopPropagation();
                    setFlipped(!flipped);
                }}
                style={{
                  backgroundColor: cardBgColor,
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                  border: `1px solid ${withOpacity(theme.text, 0.1)}`,
                  boxShadow: `0 25px 50px ${withOpacity(theme.text, 0.15)}, inset 0 1px 0 ${withOpacity(theme.text, 0.1)}`,
                  isolation: 'isolate'
                }}
             >
                 
                 {/* Card Content */}
                 <div className="absolute inset-0 p-8 flex flex-col z-10" style={{ color: theme.text }}>
                     {flipped ? (
                         <BackFace 
                            w={word.w} 
                            entry={word.entry} 
                            isFocus={true}
                            genderColors={genderColors}
                         />
                     ) : (
                         <div className="h-full flex flex-col items-center justify-center relative">
                             <div className="scale-100 w-full h-full flex items-center justify-center">
                                <FrontFace 
                                    w={word.w} 
                                    entry={word.entry} 
                                    isFocus={true}
                                    genderColors={genderColors}
                                />
                             </div>
                             <div 
                               className="absolute bottom-4 text-xs tracking-wider px-4 py-2 rounded-full border backdrop-blur-sm flex items-center gap-2"
                               style={{
                                 color: withOpacity(theme.text, 0.7),
                                 backgroundColor: withOpacity(theme.background, 0.4),
                                 borderColor: withOpacity(theme.text, 0.25),
                                 boxShadow: `0 4px 12px ${withOpacity(theme.text, 0.05)}`
                               }}
                             >
                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 15l-2 5L9 9l11 4-5 2zm0 0l5 5M7.5 7.5l3 3" />
                                </svg>
                                点击卡片翻转
                             </div>
                         </div>
                     )}
                 </div>
                 
                 {/* 顶部操作按钮区域 */}
                 <div className="absolute top-4 right-4 flex items-center gap-2 z-50">
                     {/* 缩小按钮 */}
                     <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            onClose();
                        }}
                        className="p-2 rounded-full transition-all duration-300 backdrop-blur-sm border group"
                        style={{
                            backgroundColor: withOpacity(theme.background, 0.3),
                            color: withOpacity(theme.text, 0.9),
                            borderColor: withOpacity(theme.text, 0.25)
                        }}
                        title="返回网格视图"
                     >
                         <Minimize2 className="w-5 h-5 transition-transform group-hover:scale-110" />
                     </button>
                 </div>
             </div>

             {/* Navigation Controls (Outside Card) */}
             {showNavigation && (
                 <div className="mt-8 flex justify-center items-center gap-8" onClick={e => e.stopPropagation()}>
                     <button 
                        onClick={onPrev}
                        disabled={!hasPrev}
                        className="p-4 rounded-full transition-all duration-300 shadow-lg group/btn"
                        style={{
                          backgroundColor: withOpacity(Array.isArray(theme.analogous) && theme.analogous[0] ? theme.analogous[0] : theme.secondary, 0.85),
                          color: theme.text,
                          border: `1px solid ${withOpacity(theme.text, 0.25)}`
                        }}
                        title="上一张"
                     >
                         <ChevronLeft className="w-6 h-6" />
                     </button>
                     
                     <div className="px-4 py-1 rounded-full text-xs font-mono tracking-widest backdrop-blur-md shadow-sm"
                       style={{
                         backgroundColor: withOpacity(Array.isArray(theme.analogous) && theme.analogous[0] ? theme.analogous[0] : theme.secondary, 0.6),
                         color: withOpacity(theme.text, 0.8),
                         border: `1px solid ${withOpacity(theme.text, 0.2)}`
                       }}
                     >
                         {currentIndex + 1} / {totalCount}
                     </div>

                     <button 
                        onClick={onNext}
                        disabled={!hasNext}
                        className="p-4 rounded-full transition-all duration-300 shadow-lg group/btn"
                        style={{
                          backgroundColor: withOpacity(Array.isArray(theme.analogous) && theme.analogous[1] ? theme.analogous[1] : theme.secondary, 0.85),
                          color: theme.text,
                          border: `1px solid ${withOpacity(theme.text, 0.25)}`
                        }}
                        title="下一张"
                     >
                         <ChevronRight className="w-6 h-6" />
                     </button>
                 </div>
             )}
        </div>
    );
};

