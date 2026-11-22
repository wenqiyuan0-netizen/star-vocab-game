import React, { useState, useEffect, useRef } from 'react';
import BrandLogo from '../../../shared/components/ui/BrandLogo';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../../../infrastructure/supabaseClient';
import { useI18n } from '../../../shared/i18n';
import { LanguageSwitcher } from '../../../shared/components/ui/LanguageSwitcher';

export default function LoginForm() {
  const { signIn, signUp, enterGuest } = useAuth();
  const { t } = useI18n();
  const [mode, setMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const [loading, setLoading] = useState(false);

  // Anti-bot & Validation State
  const [honeyPot, setHoneyPot] = useState(''); // Hidden field for bots
  const mountTimeRef = useRef(Date.now());
  const [nicknameError, setNicknameError] = useState('');
  const [isNicknameChecking, setIsNicknameChecking] = useState(false);
  const [isNicknameAvailable, setIsNicknameAvailable] = useState(null); // null, true, false

  const canvasRef = useRef(null);

  useEffect(() => {
    setError('');
    setOk(false);
    setNicknameError('');
    setIsNicknameAvailable(null);
  }, [mode]);

  // Nickname Debounce Check
  useEffect(() => {
    if (mode !== 'register' || !nickname) {
      setNicknameError('');
      setIsNicknameAvailable(null);
      return;
    }

    const checkAvailability = async () => {
      if (nickname.length < 2) {
        setNicknameError(t('login.err.nickShort'));
        setIsNicknameAvailable(false);
        return;
      }
      if (nickname.length > 20) {
        setNicknameError(t('login.err.nickLong'));
        setIsNicknameAvailable(false);
        return;
      }

      setIsNicknameChecking(true);
      setNicknameError('');

      try {
        const { data, error } = await supabase.rpc('check_username_exists', {
          username_input: nickname
        });

        if (error) {
          console.error('Nickname check error:', error);
          // Fallback: allow it and let backend constraint catch it if RPC fails
          setIsNicknameAvailable(true);
        } else {
          if (data) {
            setNicknameError(t('login.err.nickTaken'));
            setIsNicknameAvailable(false);
          } else {
            setIsNicknameAvailable(true);
          }
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsNicknameChecking(false);
      }
    };

    const timer = setTimeout(checkAvailability, 500);
    return () => clearTimeout(timer);
  }, [nickname, mode]);


  // Fresh "Sunlight Bokeh" Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let animationFrame;
    let particles = [];
    let width, height;

    const resize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      initParticles();
    };

    // Warm, fresh palette (Golden/Peach/Sage) - No Blue/Purple
    const colors = [
      'rgba(255, 223, 186, 0.4)', // Soft Peach
      'rgba(255, 255, 224, 0.3)', // Light Yellow
      'rgba(240, 255, 240, 0.3)', // Honeydew
      'rgba(255, 218, 185, 0.2)', // Peach Puff
      'rgba(255, 250, 205, 0.3)'  // Lemon Chiffon
    ];

    const initParticles = () => {
      particles = [];
      const count = Math.min(window.innerWidth / 15, 60); // Reduced count for lightness
      for (let i = 0; i < count; i++) {
        particles.push(createParticle());
      }
    };

    const createParticle = () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      size: Math.random() * 20 + 5, // Larger, soft bokeh
      speedX: Math.random() * 0.4 - 0.2,
      speedY: Math.random() * 0.4 - 0.2,
      color: colors[Math.floor(Math.random() * colors.length)],
      phase: Math.random() * Math.PI * 2,
      phaseSpeed: Math.random() * 0.02 + 0.005
    });

    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // Gentle gradient background (soft warm light)
      const gradient = ctx.createLinearGradient(0, 0, 0, height);
      gradient.addColorStop(0, '#fdfbf7'); // Off-white/Cream top
      gradient.addColorStop(1, '#f4efe9'); // Warm grey bottom
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, width, height);

      particles.forEach(p => {
        p.x += p.speedX;
        p.y += p.speedY;

        // Gentle pulsation
        p.phase += p.phaseSpeed;
        const pulse = Math.sin(p.phase) * 0.2 + 0.8; // 0.6 to 1.0 scale

        // Wrap around
        if (p.x < -50) p.x = width + 50;
        if (p.x > width + 50) p.x = -50;
        if (p.y < -50) p.y = height + 50;
        if (p.y > height + 50) p.y = -50;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        // Soft circle
        ctx.arc(p.x, p.y, p.size * pulse, 0, Math.PI * 2);
        ctx.fill();
      });

      animationFrame = requestAnimationFrame(animate);
    };

    window.addEventListener('resize', resize);
    resize();
    animationFrame = requestAnimationFrame(animate);

    return () => {
      window.removeEventListener('resize', resize);
      cancelAnimationFrame(animationFrame);
    };
  }, []);

  const handleLogin = async () => {
    setOk(false);
    setLoading(true);
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    const { error } = await signIn(cleanEmail, cleanPassword);
    if (error) {
      if (error.message.includes('Invalid login credentials')) {
        setError(t('login.err.credentials'));
      } else {
        setError(error.message);
      }
    }
    setLoading(false);
  };

  const handleRegister = async () => {
    setError('');
    setOk(false);

    // Anti-Bot Checks
    if (honeyPot) {
      console.warn('Bot detected: Honeypot filled');
      return;
    }

    const timeElapsed = Date.now() - mountTimeRef.current;
    if (timeElapsed < 2000) {
      setError(t('login.err.rate'));
      return;
    }

    if (!email || !password || !nickname) {
      setError(t('login.err.incomplete'));
      return;
    }

    if (nicknameError || isNicknameAvailable === false) {
      setError(t('login.err.nickInvalid'));
      return;
    }

    setLoading(true);
    const cleanEmail = email.trim();
    const cleanPassword = password.trim();
    const cleanNickname = nickname.trim();

    const { error } = await signUp(cleanEmail, cleanPassword, { full_name: cleanNickname });

    if (error) {
      if (error.message.includes('profiles_username_key')) {
        setError(t('login.err.nickTaken'));
      } else {
        setError(error.message);
      }
    } else {
      setOk(true); setError(t('login.ok.registered'));
      setMode('login');
    }
    setLoading(false);
  };

  // UI Theme: Light, Glassmorphism, Fresh
  // Text colors updated to slate/gray for readability on light background
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden text-slate-700">
      {/* Canvas Background */}
      <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />

      {/* Decorative Light Glows (Warm/Fresh) */}
      <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-orange-100/40 rounded-full blur-[120px] pointer-events-none mix-blend-multiply"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[700px] h-[700px] bg-green-100/40 rounded-full blur-[150px] pointer-events-none mix-blend-multiply"></div>

      <div className="absolute top-4 right-4 z-20"><LanguageSwitcher compact /></div>
      <div className="relative z-10 w-full max-w-md px-6 animate-fade-in-up">
        {/* Glass Card - Light Theme */}
        <div className="bg-white/60 backdrop-blur-xl rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.05)] border border-white/50 overflow-hidden relative group">

          {/* Subtle sheen */}
          <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 pointer-events-none"></div>

          <div className="p-8 relative">
            <div className="flex flex-col items-center mb-8">
              <div className="bg-white/80 p-4 rounded-2xl mb-4 shadow-sm ring-1 ring-slate-100 text-orange-500">
                {/* Pass color prop if BrandLogo accepts it, otherwise wrapper color might affect it if SVG uses currentcolor */}
                <div className="text-orange-500">
                  <BrandLogo size={64} />
                </div>
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-800">
                {t('login.title')}
              </h1>
            </div>

            {/* Tabs */}
            <div className="flex bg-slate-100/80 rounded-xl p-1 mb-6 relative">
              <div
                className={`absolute inset-y-1 w-[calc(50%-4px)] bg-white rounded-lg transition-all duration-300 ease-out shadow-sm ${mode === 'login' ? 'left-1' : 'left-[calc(50%+4px)]'}`}
              ></div>
              <button
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg relative z-10 transition-colors duration-300 ${mode === 'login' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                onClick={() => setMode('login')}
              >
                {t('login.tab.login')}
              </button>
              <button
                className={`flex-1 py-2.5 text-sm font-bold rounded-lg relative z-10 transition-colors duration-300 ${mode === 'register' ? 'text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                onClick={() => setMode('register')}
              >
                {t('login.tab.register')}
              </button>
            </div>

            <div className="space-y-4">
              {/* Nickname Field (Register Only) */}
              <div className={`space-y-1.5 overflow-hidden transition-all duration-300 ease-in-out ${mode === 'register' ? 'max-h-24 opacity-100' : 'max-h-0 opacity-0'}`}>
                <label className="text-xs font-bold text-slate-400 ml-1">{t('login.nickname')}</label>
                <div className="relative">
                  <input
                    value={nickname}
                    onChange={e => setNickname(e.target.value)}
                    className={`w-full px-4 py-3 bg-white/50 border rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:ring-2 transition-all ${nicknameError ? 'border-red-200 focus:border-red-400 focus:ring-red-100' :
                        isNicknameAvailable ? 'border-green-200 focus:border-green-400 focus:ring-green-100' :
                          'border-slate-200 focus:border-orange-300 focus:ring-orange-100'
                      }`}
                    placeholder={t('login.nickname.placeholder')}
                  />
                  <div className="absolute right-3 top-3.5 text-xs">
                    {isNicknameChecking && <span className="text-slate-400 animate-pulse">{t('login.checking')}</span>}
                  </div>
                </div>
                {nicknameError && <p className="text-[10px] text-red-500 ml-1 font-medium">{nicknameError}</p>}
              </div>

              {/* Honeypot Field */}
              <input
                type="text"
                name="website_confirm"
                value={honeyPot}
                onChange={e => setHoneyPot(e.target.value)}
                style={{ display: 'none' }}
                tabIndex={-1}
                autoComplete="off"
              />

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">{t('login.email')}</label>
                <input
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
                  placeholder="name@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-400 ml-1">{t('login.password')}</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 bg-white/50 border border-slate-200 rounded-xl text-slate-700 placeholder-slate-400 focus:outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100 transition-all"
                  placeholder="••••••••"
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      mode === 'login' ? handleLogin() : handleRegister();
                    }
                  }}
                />
              </div>

              {error && (
                <div className={`text-xs px-4 py-3 rounded-xl border font-medium ${ok
                  ? 'bg-emerald-50 text-emerald-600 border-emerald-100'
                  : 'bg-red-50 text-red-600 border-red-100'
                  }`}>
                  {error}
                </div>
              )}

              <button
                onClick={mode === 'login' ? handleLogin : handleRegister}
                disabled={loading || (mode === 'register' && (!!nicknameError || !isNicknameAvailable))}
                className="w-full py-3.5 mt-2 bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg shadow-slate-200 active:scale-[0.98]"
              >
                {loading ? t('login.processing') : (mode === 'login' ? t('login.submit.login') : t('login.submit.register'))}
              </button>
            </div>
          </div>

          <div className="px-8 pb-6 text-center space-y-3">
            <div className="flex items-center gap-3 text-[10px] text-slate-300 uppercase tracking-widest">
              <span className="flex-1 h-px bg-slate-200" />{t('login.or')}<span className="flex-1 h-px bg-slate-200" />
            </div>
            <button
              onClick={enterGuest}
              className="w-full py-3 rounded-xl font-bold text-slate-600 bg-white/60 border border-slate-200 hover:bg-white hover:border-orange-200 transition-all active:scale-[0.98]"
            >
              {t('login.guest')}
            </button>
            <p className="text-[10px] text-slate-400 uppercase tracking-widest font-medium">
              {t('login.cloudNote')}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
