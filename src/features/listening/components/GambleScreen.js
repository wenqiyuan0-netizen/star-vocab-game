import React, { useState, useEffect, useRef } from 'react';
import { Dice1, Dice2, Dice3, Dice4, Dice5, Dice6, ArrowRight, Check, X, Volume2, AlertCircle } from 'lucide-react';
import { GlassButton } from '../../../shared/components/ui/GlassButton';

export function GambleScreen({ wallet, target = 300, challenge, onNext, onSubmit, hasWords = true, generationFailed = false }) {
  const [step, setStep] = useState('roll'); // roll, answer, result
  const [rollVal, setRollVal] = useState(null);
  const [input, setInput] = useState('');
  const [isCorrect, setIsCorrect] = useState(null);
  const [earned, setEarned] = useState(0);
  const inputRef = useRef(null);

  // Reset state when challenge changes
  useEffect(() => {
    setStep('roll');
    setRollVal(null);
    setInput('');
    setIsCorrect(null);
    setEarned(0);
  }, [challenge]);

  // Focus input when answering
  useEffect(() => {
    if (step === 'answer' && inputRef.current) {
      inputRef.current.focus();
    }
  }, [step]);

  const handleRoll = () => {
    // Simple random 1-6
    const val = Math.floor(Math.random() * 6) + 1;
    setRollVal(val);
    setStep('answer');
  };

  const normalizeInput = (str) => {
    return str.trim().toLowerCase()
      .replace(/ae/g, 'ä')
      .replace(/oe/g, 'ö')
      .replace(/ue/g, 'ü')
      .replace(/ss/g, 'ß');
  };

  const handleSubmit = () => {
    if (!challenge || !challenge.answer) return;
    
    const targetWord = challenge.answer;
    const cleanInput = normalizeInput(input);
    const cleanTarget = targetWord.trim().toLowerCase();
    
    const correct = cleanInput === cleanTarget;
    setIsCorrect(correct);
    
    // Calculate potential earnings for display
    const wordLen = targetWord.length;
    const penalty = wallet?.penalty_multiplier || 1.0;
    const earnings = correct ? Math.floor(Math.ceil(wordLen * rollVal) * penalty) : 0;
    setEarned(earnings);
    
    // Submit to logic
    onSubmit(correct, wordLen, rollVal);
    setStep('result');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      if (step === 'answer') handleSubmit();
      else if (step === 'result') onNext();
    }
  };

  const progressPercent = wallet 
    ? Math.min(100, (wallet.balance / target) * 100) 
    : 0;

  const DiceIcon = [Dice1, Dice1, Dice2, Dice3, Dice4, Dice5, Dice6][rollVal || 0];

  return (
    <div className="flex flex-col h-full w-full max-w-2xl mx-auto p-4 animate-fade-in relative">
      
      {/* --- Top Bar: Progress --- */}
      <div className="mb-6 space-y-2">
        <div className="flex justify-between items-end text-white/80 text-sm font-mono">
            <span>WALLET BALANCE</span>
            <span>{wallet?.balance || 0} / {target} CHARS</span>
        </div>
        <div className="w-full h-4 bg-slate-800/80 rounded-full border border-slate-700/50 overflow-hidden relative shadow-inner">
            <div 
                className="h-full bg-gradient-to-r from-cyan-500 via-blue-500 to-purple-500 transition-all duration-700 ease-out shadow-[0_0_15px_rgba(6,182,212,0.5)]"
                style={{ width: `${progressPercent}%` }}
            />
            {/* Grid overlay for tech look */}
            <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')] opacity-30"></div>
        </div>
        {wallet?.penalty_multiplier < 1 && (
            <div className="text-center text-xs text-yellow-400 font-bold animate-pulse">
                ⚠️ PENALTY ACTIVE: EARNINGS HALVED
            </div>
        )}
      </div>

      {/* --- Main Game Area --- */}
      <div className="flex-1 flex flex-col relative">
        
        {/* Background Decorative Elements */}
        <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm rounded-3xl border border-white/5 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-white/10 to-transparent"></div>
        </div>

        <div className="relative z-10 flex-1 flex flex-col items-center justify-center p-6 space-y-8">
            
            {/* Step 1: Roll */}
            {step === 'roll' && (
                <div className="text-center animate-fade-in flex flex-col items-center gap-6">
                    <div className="w-32 h-32 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center shadow-[0_0_30px_rgba(99,102,241,0.2)]">
                        <Dice6 className="w-16 h-16 text-indigo-400 opacity-50 animate-pulse" />
                    </div>
                    <div className="space-y-2">
                        <h2 className="text-2xl font-bold text-white">Ready to Challenge?</h2>
                        <p className="text-slate-400">Roll for your score multiplier</p>
                    </div>
                    <GlassButton onClick={handleRoll} className="px-12 py-4 text-xl font-bold bg-indigo-600/80 hover:bg-indigo-500 border-indigo-400/30">
                        ROLL DICE
                    </GlassButton>
                </div>
            )}

            {/* Step 2 & 3: Answer & Result */}
            {(step === 'answer' || step === 'result') && (
                <div className="w-full max-w-lg space-y-8 animate-modal-pop">
                    
                    {/* Multiplier Badge */}
                    <div className="flex justify-center">
                        <div className="flex items-center gap-3 px-6 py-2 rounded-full bg-slate-800/80 border border-slate-700 shadow-lg">
                            <DiceIcon className={`w-6 h-6 ${rollVal >= 4 ? 'text-green-400' : 'text-yellow-400'}`} />
                            <span className="text-xl font-bold text-white tracking-wider">
                                Multiplier <span className={`${rollVal >= 4 ? 'text-green-400' : 'text-yellow-400'}`}>x{rollVal}</span>
                            </span>
                        </div>
                    </div>

                    {/* Question Card */}
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-6 md:p-8 backdrop-blur-md shadow-2xl min-h-[200px] flex flex-col justify-center">
                        {!challenge ? (
                            <div className="text-center text-slate-400">
                                {!hasWords || generationFailed ? (
                                    <div className="space-y-2 animate-fade-in">
                                        <AlertCircle className="w-10 h-10 mx-auto text-yellow-500/50 mb-2" />
                                        <p className="font-bold text-slate-300">
                                            {!hasWords ? '词库为空' : '没有有效单词'}
                                        </p>
                                        <p className="text-sm opacity-60">
                                            {!hasWords ? '请先前往单词本添加词汇' : '词库中的单词缺少必要数据'}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="animate-pulse">Loading challenge data...</div>
                                )}
                            </div>
                        ) : (
                            <>
                                {/* Context/Definition */}
                                <div className="mb-6">
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-700 text-slate-300 uppercase tracking-widest">
                                            {challenge?.type === 'cloze' ? 'Complete the Sentence' : 'Spell the Word'}
                                        </span>
                                        {(challenge?.wordInfo?.audio || true) && (
                                            <button 
                                                onClick={() => {
                                                    // TODO: Implement audio playback
                                                    // For now, use TTS if no audio file
                                                    const text = challenge?.type === 'cloze' ? challenge.sentence : challenge.answer;
                                                    if (text) {
                                                        const u = new SpeechSynthesisUtterance(text);
                                                        u.lang = 'de-DE';
                                                        window.speechSynthesis.speak(u);
                                                    }
                                                }}
                                                className="p-2 rounded-full bg-white/5 hover:bg-white/10 transition-colors"
                                            >
                                                <Volume2 className="w-5 h-5 text-cyan-400" />
                                            </button>
                                        )}
                                    </div>
                                    
                                    {challenge?.type === 'cloze' || challenge?.type === 'translation_hard' ? (
                                        <div className="text-xl md:text-2xl leading-relaxed text-slate-200 font-serif">
                                            {challenge.parts.map((part, idx) => (
                                                part.type === 'cloze' ? (
                                                    <span key={idx} className="inline-block min-w-[80px] border-b-2 border-cyan-500/50 mx-1 text-center text-cyan-400 font-mono">
                                                        {step === 'result' ? part.text : (part.hint || '___')}
                                                    </span>
                                                ) : (
                                                    <span key={idx} dangerouslySetInnerHTML={{ __html: part.text }}></span>
                                                )
                                            ))}
                                            {challenge.sentenceTranslation && (
                                                <div className={`mt-4 font-sans border-t border-white/5 pt-2 ${challenge.type === 'translation_hard' ? 'text-lg text-cyan-200' : 'text-sm text-slate-500'}`}>
                                                    {challenge.sentenceTranslation}
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="text-center py-4">
                                            <div className="text-2xl text-slate-200 font-bold mb-3">
                                                {challenge?.wordInfo?.meaning || challenge?.wordInfo?.cn || challenge?.wordInfo?.trans || "No definition available"}
                                            </div>
                                            <div className="text-sm text-slate-500 font-mono bg-black/20 inline-block px-2 py-1 rounded">
                                                {challenge?.wordInfo?.type || "unknown"}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Input Area */}
                                <div className="relative">
                                    <input
                                        ref={inputRef}
                                        type="text"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={handleKeyDown}
                                        disabled={step === 'result'}
                                        placeholder="Type answer..."
                                        className={`w-full bg-slate-900/50 border-2 rounded-xl px-5 py-4 text-xl text-center font-bold tracking-wider outline-none transition-all
                                            ${step === 'result' 
                                                ? (isCorrect ? 'border-green-500/50 text-green-400' : 'border-red-500/50 text-red-400')
                                                : 'border-white/10 focus:border-cyan-500/50 text-white placeholder:text-slate-600'
                                            }
                                        `}
                                        autoComplete="off"
                                        autoCorrect="off"
                                        spellCheck="false"
                                    />
                                    
                                    {/* Result Icon Overlay */}
                                    {step === 'result' && (
                                        <div className="absolute right-4 top-1/2 -translate-y-1/2">
                                            {isCorrect ? (
                                                <Check className="w-6 h-6 text-green-500 animate-bounce" />
                                            ) : (
                                                <X className="w-6 h-6 text-red-500 animate-pulse" />
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Hint / Correct Answer display on failure */}
                                {step === 'result' && !isCorrect && (
                                    <div className="mt-4 text-center animate-fade-in">
                                        <p className="text-slate-400 text-sm mb-1">Correct answer:</p>
                                        <p className="text-xl font-bold text-red-300">{challenge?.answer}</p>
                                    </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    <div className="flex justify-center pt-4">
                        {step === 'answer' ? (
                            <GlassButton onClick={handleSubmit} className="w-full max-w-xs py-3 font-bold text-lg bg-cyan-600/80 hover:bg-cyan-500 border-cyan-400/30">
                                SUBMIT
                            </GlassButton>
                        ) : (
                            <div className="text-center space-y-4 w-full">
                                {isCorrect && (
                                    <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-green-400 to-emerald-300 animate-pulse">
                                        +{earned} XP
                                    </div>
                                )}
                                <GlassButton onClick={onNext} className="w-full max-w-xs py-3 font-bold text-lg">
                                    NEXT CHALLENGE <ArrowRight className="w-5 h-5 ml-2" />
                                </GlassButton>
                            </div>
                        )}
                    </div>

                </div>
            )}
        </div>
      </div>
    </div>
  );
}
