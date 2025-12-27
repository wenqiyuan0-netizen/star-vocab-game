import React, { useState, useMemo, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Minimize2, Sparkles, Volume2 } from 'lucide-react';
import { useTheme } from '../../../shared/hooks/useTheme';
import { generateGenderColors, withOpacity, getContrastColorFromTheme, desaturate } from '../../../utils/colorUtils';
import { aiService } from '../../../shared/services/ai/AIService';
import { localLemmatization } from '../../../utils/localLemmatization';
import { localDictDB } from '../../../shared/services/dictionary/LocalDictionaryDB';

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

  // Helper to strip article
  const stripArticle = (s) => (s || '').replace(/^(der|die|das)\s+/i, '').trim();

  // 1. Determine Article
  // Priority: entry.article > entry.gender > w.gender
  const derivedArticle = (entry && entry.article)
    || (entry && entry.gender ? genderToArticle(entry.gender) : '')
    || (w.gender ? genderToArticle(w.gender) : '');

  // 2. Determine Base Word
  // Priority: entry.base > entry.word > entry.headword (cleaned) > w.de (cleaned)
  const derivedBase = (entry && (entry.base || entry.word))
    || (entry && entry.headword ? stripArticle(entry.headword) : '')
    || stripArticle(w.de);

  // 3. Construct Head
  const validArticle = ['der', 'die', 'das'].includes((derivedArticle || '').toLowerCase()) ? derivedArticle : '';
  const head = validArticle ? `${validArticle} ${derivedBase}` : derivedBase;

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
            <span className={isFocus ? 'font-serif italic mr-2 opacity-90' : 'font-serif italic mr-1'}>{parts[0]}</span>
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

  // Conjugation state
  const [showConjugation, setShowConjugation] = useState(false);
  const [conjugationData, setConjugationData] = useState(null);
  const [loadingConjugation, setLoadingConjugation] = useState(false);


  const handleGenerateExample = async (e) => {
    e.stopPropagation();

    // Note: Backend validates level via gemini-proxy (secure check)
    // Frontend only shows optimistic UI hint, but actual check is server-side

    setLoadingAi(true);
    setAiError(null);
    try {
      const result = await aiService.generateExample(w.de, w.cn);
      if (result) {
        setAiExample({
          sentence: result.de,
          translation: result.cn,
          source: 'ai_gen'
        });

        // Save to local dictionary (independent examples store)
        try {
          await localDictDB.bulkSaveExamples([{
            word: w.de,
            sentence: result.de,
            translation: result.cn,
            source: 'ai_gen',
            created_at: Date.now()
          }]);
          console.log('[WordCard] AI example saved to local dictionary');
        } catch (saveErr) {
          console.error('[WordCard] Failed to save AI example:', saveErr);
        }
      }
    } catch (err) {
      console.error("AI Gen Error:", err);
      // Backend returns "Level too low" or "AI feature requires Level X" messages
      // Parse the error to display a user-friendly message
      const errorMessage = err.message || '生成失败';
      if (errorMessage.includes('Level') || errorMessage.includes('level')) {
        // Backend returned a level-related error with accurate current level
        setAiError(errorMessage);
      } else {
        setAiError(errorMessage);
      }
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

  // Helper for source labels
  const getSourceLabel = (sourceId) => {
    if (!sourceId) return null;
    if (sourceId.includes('goethe_a1')) return 'Goethe A1';
    if (sourceId.includes('goethe_a2')) return 'Goethe A2';
    if (sourceId.includes('goethe_b1')) return 'Goethe B1';
    if (sourceId.includes('goethe_b2')) return 'Goethe B2';
    if (sourceId.includes('wiktionary') || sourceId.includes('wikt')) return 'Wiktionary';
    if (sourceId.includes('ai_gen')) return 'AI';
    return null;
  };

  const getSourceColor = (sourceId) => {
    if (!sourceId) return theme.text;
    if (sourceId.includes('goethe')) return theme.accent;
    if (sourceId.includes('wikt')) return theme.secondary;
    if (sourceId.includes('ai')) return theme.primary;
    return theme.text;
  };

  // Data extraction
  const examples = entry && Array.isArray(entry.examples) ? entry.examples : [];
  const displayExamples = showAllExamples ? examples : examples.slice(0, isFocus ? 5 : 3);

  const article = entry?.article || genderToArticle(entry?.gender || w.gender);
  const headword = entry?.base || entry?.word || (entry?.headword ? entry.headword.replace(/^(der|die|das)\s+/, '') : w.de);
  const pos = entry?.pos || entry?.partOfSpeech || w.pos;
  const plural = entry?.plural || entry?.pluralForm;
  const conjugations = entry?.conjugations || entry?.conjugation;
  const isVerb = pos && (typeof pos === 'string') && (pos.toLowerCase().includes('verb') || pos.toLowerCase().startsWith('v.'));

  // Check for Goethe source
  const sources = entry?.sources || [];
  const goetheSource = sources.find(s => s.id && s.id.includes('goethe'));
  const goetheLabel = goetheSource ? (goetheSource.id.includes('a1') ? 'Goethe-Zertifikat A1' :
    goetheSource.id.includes('a2') ? 'Goethe-Zertifikat A2' :
      goetheSource.id.includes('b1') ? 'Goethe-Zertifikat B1' : 'Goethe-Zertifikat') : null;

  // Pronunciation data
  const ipa = entry?.ipa || w.ipa;
  const audioUrl = entry?.audio_url || entry?.audioUrl || entry?.audio || w.audio_url || w.audioUrl || w.audio;

  const handleShowConjugation = async (e) => {
    e.stopPropagation();
    if (showConjugation) {
      setShowConjugation(false);
      return;
    }

    setShowConjugation(true);
    if (!conjugationData && !loadingConjugation) {
      setLoadingConjugation(true);
      try {
        // 使用 headword (原型) 查询
        const data = await localLemmatization.getWordForms(headword);
        setConjugationData(data);
      } catch (error) {
        console.error('Failed to load conjugations:', error);
      } finally {
        setLoadingConjugation(false);
      }
    }
  };

  // Audio playback handler
  const playAudio = (e) => {
    e.stopPropagation();
    if (audioUrl) {
      const audio = new Audio(audioUrl);
      audio.play().catch(err => {
        console.error('[WordCard] Audio playback failed:', err);
        alert(`音频播放失败：${err.message}`);
      });
    }
  };

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
    <div className={`flex flex-col h-full text-left w-full ${isFocus ? 'gap-4' : 'gap-2'}`}>

      {/* 滚动容器 */}
      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-5">

        {/* Header: Article + Word + POS */}
        <div className="flex flex-col gap-2 border-b pb-4" style={dividerStyle}>
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
            <div className="flex items-center gap-2 flex-wrap">
              {pos && (
                <span
                  className={`${isFocus ? 'text-sm px-3 py-1.5' : 'text-xs px-2 py-0.5'} rounded-full border uppercase tracking-wider`}
                  style={{
                    backgroundColor: withOpacity(theme.primary, 0.25),
                    color: theme.text,
                    borderColor: withOpacity(theme.primary, 0.4)
                  }}
                >
                  {pos}
                </span>
              )}

              {/* 显示所有来源标签 */}
              {(entry?.source_tags || w.source_tags || []).map((tag, idx) => (
                <span
                  key={idx}
                  className="text-xs px-2 py-0.5 rounded-full border font-medium tracking-wide"
                  style={{
                    backgroundColor: withOpacity(theme.accent, 0.3),
                    color: `color-mix(in srgb, ${theme.accent}, #000000 80%)`,
                    borderColor: withOpacity(theme.accent, 0.5)
                  }}
                >
                  {tag}
                </span>
              ))}

              {/* Fallback for old Goethe Logic if no tags */}
              {!entry?.source_tags && !w.source_tags && goetheLabel && isFocus && (
                <span
                  className="text-xs px-2 py-0.5 rounded-full border font-medium tracking-wide"
                  style={{
                    backgroundColor: withOpacity(theme.accent, 0.3),
                    color: `color-mix(in srgb, ${theme.accent}, #000000 80%)`,
                    borderColor: withOpacity(theme.accent, 0.5)
                  }}
                >
                  {goetheLabel}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Definition */}
        <div className="relative">
          {(entry?.source_tags || goetheLabel) && isFocus && (
            <div
              className="absolute -left-3 top-1 w-1 h-full rounded-full"
              style={{ backgroundColor: withOpacity(theme.accent, 0.5) }}
            ></div>
          )}
          <div
            className={`${isFocus ? 'text-2xl pl-1' : 'text-base'} font-medium leading-relaxed`}
            style={{ color: isFocus ? theme.text : withOpacity(theme.text, 0.95) }}
          >
            {w.cn || entry?.cn || entry?.translation || '暂无释义'}
          </div>
        </div>

        {/* Pronunciation: IPA & Audio */}
        {(ipa || audioUrl) && (
          <div
            className={`flex items-center gap-4 ${isFocus ? 'py-3 px-4 rounded-lg' : 'py-1.5 px-3 rounded'} border`}
            style={{
              backgroundColor: withOpacity(theme.secondary, 0.06),
              borderColor: withOpacity(theme.secondary, 0.15)
            }}
          >
            {ipa && (
              <div className="flex items-center gap-3 flex-1">
                <span style={isFocus ? { ...labelStyle, color: withOpacity(theme.text, 0.6) } : labelStyle} className="w-16 flex-shrink-0 font-medium">音标</span>
                <span className={`font-mono ${isFocus ? 'text-base' : 'text-sm'}`} style={{ color: withOpacity(theme.text, 0.85) }}>
                  {ipa}
                </span>
              </div>
            )}
            {audioUrl && (
              <button
                onClick={playAudio}
                className={`flex items-center gap-1.5 ${isFocus ? 'px-3 py-1.5' : 'px-2 py-1'} rounded-full transition-all hover:scale-105 active:scale-95`}
                style={{
                  backgroundColor: withOpacity(theme.text, 0.1),
                  color: theme.text,
                  border: `1px solid ${withOpacity(theme.text, 0.25)}`
                }}
                title="播放发音"
              >
                <Volume2 className={isFocus ? 'w-4 h-4' : 'w-3 h-3'} />
                {isFocus && <span className="text-xs font-medium">发音</span>}
              </button>
            )}
          </div>
        )}

        {/* Plural & Conjugation */}
        {(plural || conjugations || isVerb) && (
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
                <span style={isFocus ? { ...labelStyle, color: withOpacity(theme.text, 0.6) } : labelStyle} className="w-16 flex-shrink-0 font-medium">复数</span>
                <span className="font-mono text-sm" style={{ color: isFocus ? withOpacity(theme.text, 0.9) : withOpacity(theme.text, 0.9) }}>{plural}</span>
              </div>
            )}

            {(conjugations || isVerb) && (
              <div className="flex flex-col gap-2 w-full">
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <span style={isFocus ? { ...labelStyle, color: withOpacity(theme.text, 0.6) } : labelStyle} className="w-16 flex-shrink-0 mt-0.5 font-medium">变位</span>
                    {!showConjugation && conjugations && (
                      <span className="font-mono text-sm italic" style={{ color: isFocus ? withOpacity(theme.text, 0.9) : withOpacity(theme.text, 0.8) }}>
                        {typeof conjugations === 'string' ? conjugations : (Array.isArray(conjugations) ? conjugations.join(', ') : JSON.stringify(conjugations))}
                      </span>
                    )}
                  </div>

                  <button
                    onClick={handleShowConjugation}
                    className="text-xs px-2 py-0.5 rounded border transition-all hover:scale-105 active:scale-95"
                    style={{
                      color: `color-mix(in srgb, ${theme.primary}, #000000 80%)`,
                      borderColor: withOpacity(theme.primary, 0.3),
                      backgroundColor: withOpacity(theme.primary, 0.1)
                    }}
                  >
                    {showConjugation ? '收起' : '查看变位表'}
                  </button>
                </div>

                {showConjugation && (
                  <div className="mt-2 w-full animate-fade-in">
                    {loadingConjugation ? (
                      <div className="text-sm opacity-70 py-2 flex items-center gap-2">
                        <div className="w-3 h-3 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: theme.text }}></div>
                        正在加载变位表...
                      </div>
                    ) : (conjugationData && conjugationData.length > 0) ? (
                      <div className="grid grid-cols-2 gap-2 text-sm max-h-60 overflow-y-auto custom-scrollbar pr-1">
                        {conjugationData.map((item, idx) => (
                          <div key={idx} className="flex flex-col p-2 rounded" style={{ backgroundColor: withOpacity(theme.text, 0.05) }}>
                            <span className="font-bold font-serif">{item.form}</span>
                            <span className="text-[10px] opacity-70 leading-tight mt-0.5">{item.tags ? item.tags.join(', ') : ''}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-sm opacity-70 py-2 italic">
                        {conjugationData ? '暂无详细变位信息' : '加载失败'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Examples */}
        {examples.length > 0 && (
          <div className="flex flex-col gap-3 mt-2">
            <div className="flex items-center justify-between mb-1">
              <span style={isFocus ? { ...labelStyle, color: withOpacity(theme.text, 0.6) } : labelStyle} className="font-medium">示例</span>
              {isFocus && (
                <button
                  onClick={handleGenerateExample}
                  disabled={loadingAi}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs transition-all ${loadingAi ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                  style={{
                    backgroundColor: withOpacity(theme.accent, 0.15),
                    color: theme.accent,
                    border: `1px solid ${withOpacity(theme.accent, 0.3)}`,
                    cursor: loadingAi ? 'not-allowed' : 'pointer'
                  }}
                  title="AI 生成例句 (需要 Lv.10)"
                >
                  <Sparkles className="w-3 h-3" />
                  {loadingAi ? '生成中...' : 'AI 造句'}
                </button>
              )}
            </div>

            <div className="space-y-3">
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
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[0.6rem] opacity-70 uppercase tracking-widest font-bold" style={{ color: theme.accent }}>AI</span>
                  </div>
                </div>
              )}

              {aiError && (
                <div className="text-xs px-2 py-1 rounded bg-red-50 text-red-500 mb-2 border border-red-100">
                  {aiError}
                </div>
              )}

              {displayExamples.map((ex, i) => {
                const sourceLabel = getSourceLabel(ex.source);
                const sourceColor = getSourceColor(ex.source);

                return (
                  <div
                    key={i}
                    className="relative pl-4 border-l-2 transition-all duration-300 group hover:border-l-3 hover:bg-white/5 rounded-r-lg p-1"
                    style={{ borderColor: withOpacity(sourceColor, 0.4) }}
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
                    {/* Source Label for Example */}
                    {sourceLabel && isFocus && (
                      <div className="mt-1 flex justify-end">
                        <span
                          className="text-[0.6rem] px-1.5 py-0.5 rounded border opacity-60"
                          style={{
                            color: sourceColor,
                            borderColor: withOpacity(sourceColor, 0.3)
                          }}
                        >
                          {sourceLabel}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
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
  // Desaturate the background to make text and buttons more visible
  const cardBgColor = useMemo(() => {
    const baseColor = propCardBgColor || withOpacity(theme.background, 0.65);
    return desaturate(baseColor, 0.4); // Reduce saturation by 40%
  }, [theme.background, propCardBgColor]);

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

