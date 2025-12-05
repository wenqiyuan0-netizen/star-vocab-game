import { BACKEND_URL } from '../config'
//AI Service
class AIService {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.apiKey = '';
    this.isSpeaking = false;
    this.accessToken = null; // Store user's Supabase token
    this.currentUtterance = null; // Keep reference to prevent GC
  }

  setApiKey(key) {
    this.apiKey = key;
  }

  // Set the user's access token for authenticated requests
  setAccessToken(token) {
    this.accessToken = token;
  }

  warmUp() {
    if (!this.synth) return;
    try {
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0;
      this.synth.speak(u);
    } catch (e) {}
  }

  speak(text, lang = 'de-DE') {
    if (!this.synth) return;
    this.synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    this.currentUtterance = utterance; // Prevent GC
    utterance.lang = lang;
    utterance.rate = 0.9;
    
    const voices = this.synth.getVoices();
    const betterVoice = voices.find(
      v =>
        v.lang === lang &&
        (v.name.includes('Google') || v.name.includes('Anna') || v.name.includes('Siri'))
    );
    if (betterVoice) utterance.voice = betterVoice;
    
    utterance.onend = () => { this.currentUtterance = null; };
    utterance.onerror = (e) => { console.error("TTS Error", e); this.currentUtterance = null; };
    
    this.synth.speak(utterance);
  }

  stopAll() {
    if (this.synth) this.synth.cancel();
  }

  async generateExample(wordDe, wordCn) {
    const prompt = `Generate one simple, short German sentence using the word "${wordDe}" (${wordCn}). Return ONLY a JSON object with this format: {"de": "...", "cn": "..."}. No markdown.`;
    return this._fetchGemini(prompt);
  }

  async generateBatchExamples(wordList) {
    if (wordList.length === 0) return null;

    const itemsStr = wordList
      .map(w => `{"id":"${w.id}","word":"${w.de}","meaning":"${w.cn}"}`)
      .join(',');

    const prompt =
      `You are a bilingual German-Chinese assistant. For EACH item in the following JSON array, ` +
      `create ONE short, simple A1–A2 German sentence that naturally uses the given word. ` +
      // ★★★ 强制简体中文 ★★★
      `Output Chinese MUST be Simplified Chinese (zh-CN). ` +
      `Input: [${itemsStr}]. ` +
      `Return a STRICT JSON array with the SAME length. ` +
      `Each element MUST be exactly: {"id":"<same as input id>","de":"<German>","cn":"<Chinese>"}. ` +
      `No explanations. No markdown.`;

    const out = await this._fetchGemini(prompt);
    if (!out) return null;

    let arr = Array.isArray(out) ? out : [];
    arr = arr.map((o, i) => ({
      id: o.id ?? wordList[i]?.id,
      de: o.de,
      cn: o.cn,
    }));
    return arr;
  }

  async generateVocabularyFromArticle(articleText, recentWords) {
    const levelHint = (recentWords || [])
      .map(w => `${w.de} - ${w.cn}`)
      .join('; ');
    const truncated = String(articleText || '').slice(0, 3000);
    const prompt =
      `You are a bilingual German-Chinese vocabulary assistant. ` +
      `User's recent memorized words (indicating level): ${levelHint}.\n` +
      `Article (truncated to 3000 chars):\n${truncated}\n` +
      `Extract up to 40 key vocabulary items suited to the level, deduplicated. ` +
      `Use correct article for nouns (der/die/das), verbs in infinitive, adjectives in base form. ` +
      `Return a STRICT JSON array. Each element MUST be exactly {"de":"<German>","cn":"<Chinese>"}. ` +
      `NO markdown, NO explanations.`;
    const out = await this._fetchGemini(prompt);
    if (out && Array.isArray(out)) {
      const lines = out
        .map(o => `${String(o.de || '').trim()}; ${String(o.cn || '').trim()}`)
        .filter(s => s.replace(/\s+/g, '').length > 3)
        .join('\n');
      if (lines.trim()) return lines;
    }
    const fallback = this._extractVocabLocally(truncated, recentWords);
    if (!fallback || fallback.length === 0) return '';
    return fallback.map(w => `${w}; 未翻译`).join('\n');
  }

  async _fetchGemini(prompt) {
    const url = `${BACKEND_URL}/api/gemini-proxy`;

    let data = null;

    for (let i = 0; i < 3; i++) {
      try {
        const bodyPayload = {
          prompt,
          model: 'gemini-2.5-flash-preview-09-2025'
        };
        if (this.apiKey) {
          bodyPayload.apiKey = this.apiKey;
        }

        console.log(`[AIService] Sending request to ${url}`, { bodyPayload });

        const headers = { 'Content-Type': 'application/json' };
        if (this.accessToken) {
          headers['Authorization'] = `Bearer ${this.accessToken}`;
        }

        const res = await fetch(url, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify(bodyPayload),
        });

        if (!res.ok) {
          // Handle 403 Forbidden (Feature Locked) specifically
          if (res.status === 403) {
            const errData = await res.json();
            console.error(`[AIService] Feature Locked: ${errData.message}`);
            throw new Error(errData.message || 'Level too low for AI features');
          }
          // 429 → 重试
          if (res.status === 429) {
            const delay = Math.pow(2, i) * 800 + Math.random() * 500;
            await new Promise(r => setTimeout(r, delay));
            continue;
          }
          return null;
        }

        data = await res.json();
        break;
      } catch (err) {
        // 网络异常 → 重试
        const delay = Math.pow(2, i) * 800 + Math.random() * 500;
        await new Promise(r => setTimeout(r, delay));
      }
    }

    if (!data) return null;
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    let clean = raw.replace(/```json|```/g, '').trim();
    const match = clean.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (!match) {
      console.warn('[AIService] No JSON found in response');
      return null;
    }
    try { return JSON.parse(match[0]); } catch (e) { return null; }
  }

  _extractVocabLocally(text, recentWords) {
    const src = String(text || '');
    const tokens = src
      .replace(/[^A-Za-zÄÖÜäöüß\-\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    const stop = new Set([
      'und','oder','aber','nicht','auch','mit','für','von','zu','im','in','aus','am','an','auf','bei','als','wie','bis','nach','über','unter','vor','hinter','zwischen','ohne','durch','gegen','seit','weil','dass','da','wenn','denn','so','nur','schon','noch','mehr','sehr','hier','dort','man','ich','du','er','sie','es','wir','ihr','ihnen','ihm','mir','dir','sein','sind','war','waren','wird','werden','hat','haben','wurde','kann','können','muss','müssen','soll','sollen','würde','wäre','bin','bist','ist','seid','dem','den','die','der','das','ein','eine','einen','einem','einer','kein','keine','keinen','keinem','keiner'
    ]);

    const freq = new Map();
    const exampleForm = new Map();
    for (const t of tokens) {
      const clean = t.replace(/^-+|-+$/g, '');
      if (!clean || clean.length < 3) continue;
      if (!/^[-A-Za-zÄÖÜäöüß]+$/.test(clean)) continue;
      const lower = clean.toLowerCase();
      if (stop.has(lower)) continue;
      freq.set(lower, (freq.get(lower) || 0) + 1);
      if (!exampleForm.has(lower)) exampleForm.set(lower, clean);
    }

    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
    const out = [];
    const seen = new Set();
    for (const w of sorted) {
      if (out.length >= 40) break;
      if (seen.has(w)) continue;
      seen.add(w);
      out.push(exampleForm.get(w) || w);
    }
    return out;
  }
}


const aiService = new AIService();

export { aiService };
