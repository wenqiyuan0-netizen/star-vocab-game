import { BACKEND_URL } from '../../constants/config'
import { unifiedSearch } from '../../../utils/unifiedDictionarySearch';

// Simple TextRank Implementation for German
class TextRank {
  constructor(text, windowSize = 4, dampingFactor = 0.85, iterations = 20) {
    this.text = text;
    this.windowSize = windowSize;
    this.d = dampingFactor;
    this.iterations = iterations;
    this.tokens = [];
    this.graph = new Map(); // Adjacency list: word -> Set(neighbors)
    this.scores = new Map();
  }

  _tokenize() {
    // Basic German tokenization
    const src = String(this.text || '');
    // Clean and split
    const rawTokens = src
      .replace(/[^A-Za-zÄÖÜäöüß\-\s]/g, ' ')
      .split(/\s+/)
      .filter(Boolean);

    // Stopwords list (German)
    const stop = new Set([
      'und', 'oder', 'aber', 'nicht', 'auch', 'mit', 'für', 'von', 'zu', 'im', 'in', 'aus', 'am', 'an', 'auf', 'bei', 'als', 'wie', 'bis', 'nach', 'über', 'unter', 'vor', 'hinter', 'zwischen', 'ohne', 'durch', 'gegen', 'seit', 'weil', 'dass', 'da', 'wenn', 'denn', 'so', 'nur', 'schon', 'noch', 'mehr', 'sehr', 'hier', 'dort', 'man', 'ich', 'du', 'er', 'sie', 'es', 'wir', 'ihr', 'ihnen', 'ihm', 'mir', 'dir', 'sein', 'sind', 'war', 'waren', 'wird', 'werden', 'hat', 'haben', 'wurde', 'kann', 'können', 'muss', 'müssen', 'soll', 'sollen', 'würde', 'wäre', 'bin', 'bist', 'ist', 'seid', 'dem', 'den', 'die', 'der', 'das', 'ein', 'eine', 'einen', 'einem', 'einer', 'kein', 'keine', 'keinen', 'keinem', 'keiner',
      'diese', 'dieser', 'dieses', 'jenes', 'jener', 'jene', 'solche', 'solcher', 'solches', 'alle', 'aller', 'alles', 'nichts', 'etwas', 'viel', 'viele'
    ]);

    this.tokens = [];
    this.originalForms = new Map(); // lower -> original

    for (const t of rawTokens) {
      const clean = t.replace(/^-+|-+$/g, '');
      if (!clean || clean.length < 3) continue;
      if (!/^[-A-Za-zÄÖÜäöüß]+$/.test(clean)) continue;
      
      const lower = clean.toLowerCase();
      if (stop.has(lower)) continue;

      this.tokens.push(lower);
      if (!this.originalForms.has(lower)) {
        this.originalForms.set(lower, clean);
      }
    }
  }

  _buildGraph() {
    // Build graph based on co-occurrence window
    for (let i = 0; i < this.tokens.length; i++) {
      const current = this.tokens[i];
      if (!this.graph.has(current)) this.graph.set(current, new Set());
      
      const end = Math.min(i + this.windowSize, this.tokens.length);
      for (let j = i + 1; j < end; j++) {
        const neighbor = this.tokens[j];
        if (current === neighbor) continue;
        
        // Add undirected edge
        this.graph.get(current).add(neighbor);
        if (!this.graph.has(neighbor)) this.graph.set(neighbor, new Set());
        this.graph.get(neighbor).add(current);
      }
    }
    
    // Initialize scores
    for (const node of this.graph.keys()) {
      this.scores.set(node, 1.0);
    }
  }

  _iterate() {
    for (let i = 0; i < this.iterations; i++) {
      const newScores = new Map();
      let maxDiff = 0;

      for (const node of this.graph.keys()) {
        let sum = 0;
        const neighbors = this.graph.get(node);
        
        for (const neighbor of neighbors) {
          const neighborDegree = this.graph.get(neighbor).size;
          sum += (this.scores.get(neighbor) / neighborDegree);
        }
        
        const newScore = (1 - this.d) + (this.d * sum);
        newScores.set(node, newScore);
        
        maxDiff = Math.max(maxDiff, Math.abs(newScore - (this.scores.get(node) || 0)));
      }
      
      this.scores = newScores;
      if (maxDiff < 0.0001) break; // Converged
    }
  }

  getKeywords(topN = 40) {
    this._tokenize();
    this._buildGraph();
    this._iterate();

    // Sort by score
    const sorted = [...this.scores.entries()].sort((a, b) => b[1] - a[1]);
    
    return sorted.slice(0, topN).map(([word, score]) => ({
      word: this.originalForms.get(word) || word,
      score: score
    }));
  }
}

//AI Service
class AIService {
  constructor() {
    this.synth = window.speechSynthesis || null;
    this.isSpeaking = false;
    this.accessToken = null; // Store user's Supabase token
    this.currentUtterance = null; // Keep reference to prevent GC
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
    } catch (e) { }
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

    // 1. 优先尝试本地提取 (Code First)
    let vocabLines = '';
    try {
      vocabLines = await this._extractVocabLocally(truncated, recentWords);
      vocabLines = await this._enrichWithLocalDict(vocabLines); // vocabLines here is array of objects from _extractVocabLocally
    } catch (e) {
      console.warn('Local extraction failed:', e);
    }

    // 检查本地提取结果质量
    // 如果结果太少 (比如少于 5 个)，或者完全失败，则降级调用 AI
    const lineCount = vocabLines ? vocabLines.split('\n').filter(Boolean).length : 0;
    
    /* 
    // AI Fallback Logic (Currently Disabled)
    // 命中率低 (Low Hit Rate) 时调用 AI
    if (lineCount < 5) {
      console.log(`[AIService] Local extraction yielded only ${lineCount} words. Falling back to AI...`);
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
        const aiLines = out
          .map(o => `${String(o.de || '').trim()}; ${String(o.cn || '').trim()}`)
          .filter(s => s.replace(/\s+/g, '').length > 3)
          .join('\n');
        
        if (aiLines.trim()) {
           return aiLines; // Return AI result if successful
        }
      }
    }
    */

    return vocabLines;
  }

  async _enrichWithLocalDict(items) {
    const enriched = [];
    
    // Process items (now objects with {word, trScore})
    for (const item of items) {
      const w = item.word;
      const trScore = item.trScore || 1.0;
      
      try {
        // Use unifiedSearch to handle lemmatization
        const result = await unifiedSearch.search(w, { enableCloud: false });
        
        if (result.found && result.entries && result.entries.length > 0) {
          // Find the best entry
          let entry = result.entries.find(e => e.c && e.c.length > 0) || result.entries[0];
          
          // Must have Chinese translation to be included
          if (!entry.c || entry.c.length === 0) continue;

          const translation = entry.c.join('；');
          
          // Rank (General Frequency): 1 = most common, 2500 = less common
          // High Rank number = Rare word
          const rank = (typeof entry.rank === 'number') ? entry.rank : 5000;
          
          // 【Step 2】: 抛弃词频极高的词 (e.g. Rank 1-100)，除非 TextRank 分数非常高
          // (例如在 Rank <= 100 且 TextRank 分数不是极高的情况下过滤)
          // 简单处理：直接过滤掉前 100 最常用词
          if (rank <= 100) continue;

          // 【Step 3】: 计算最终“生词指数”
          // Formula: Score = TextRank_Score * (1 / log(General_Frequency_Rank)) ?
          // Wait, user formula: Score = TextRank * (1 / log(Frequency))
          // "Frequency" usually means raw count. 
          // Our 'rank' is already an inverse-like metric (1 is high freq, 5000 is low freq).
          // So, Low Rank = High Freq = Low Importance (according to formula 1/log(freq)).
          // Actually, if Rank is high (rare word), we want to KEEP it.
          // If Rank is low (common word), we want to DISCARD/LOWER it.
          
          // Let's adapt the user's idea to our data:
          // User: "词频越低越重要" -> Our Rank: "Rank越高(数字大)越重要"
          // User: Score = TextRank * (1 / log(GenFreq))
          // Since Rank ~ 1/GenFreq (roughly, Zipf's law), 
          // we can approximate: Score = TextRank * log(Rank)
          // Reason:
          //  - High Rank (Rare) -> High log(Rank) -> High Score -> Keep
          //  - Low Rank (Common) -> Low log(Rank) -> Low Score -> Drop
          
          const rankLog = Math.log(Math.max(rank, 2)); // Avoid log(1)=0
          const score = trScore * rankLog;

          const displayWord = entry.w || w;
          
          // Avoid duplicates in enriched list
          if (!enriched.some(e => e.w === displayWord)) {
            enriched.push({ 
              w: displayWord, 
              t: translation, 
              s: score,
              debug: `TR:${trScore.toFixed(4)} * log(R:${rank})=${score.toFixed(4)}`
            });
          }
        }
      } catch (e) {
        console.warn(`[AIService] Failed to lookup ${w}:`, e);
      }
    }

    // Sort by Score (High to Low)
    enriched.sort((a, b) => b.s - a.s);

    // Take top 40
    const finalSelection = enriched.slice(0, 40);

    return finalSelection.map(item => `${item.w}; ${item.t}`).join('\n');
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

  async _extractVocabLocally(text, recentWords) {
    // Use TextRank to get candidates
    // Requesting top 30% or at least top 100 keywords to ensure enough candidates for filtering
    // The user suggested "top 30-50%", let's take top 150 keywords to be safe for a short article.
    const textRank = new TextRank(text);
    const textRankCandidates = textRank.getKeywords(150).map(c => ({
      word: c.word,
      trScore: c.score // Pass TextRank score for later calculation
    }));

    // Detect Separable Verbs (e.g. "fängt ... an" -> "anfangen")
    // Returns candidates AND a set of "consumed" fragments to remove
    const { candidates: separableCandidates, consumedFragments } = await this._findSeparableVerbs(text);

    // Filter textRankCandidates to remove fragments that were used in separable verbs
    const filteredTextRankCandidates = textRankCandidates.filter(c => !consumedFragments.has(c.word.toLowerCase()));

    // Merge candidates (Separable verbs are added to the list)
    const combined = [...filteredTextRankCandidates, ...separableCandidates];

    // Map to format expected by _enrichWithLocalDict
    return combined;
  }

  async _findSeparableVerbs(text) {
    // Separable Prefixes Set
    const SEPARABLE_PREFIXES = new Set([
      "ab", "an", "auf", "aus", "bei", "ein", "los", "mit", "nach", "vor", "zu", 
      "weg", "fort", "nieder", "frei", "fest", "heim", "dar", "heran", "voraus", 
      "her", "herauf", "heraus", "herein", "herüber", "herum", "herunter", "hervor", 
      "hin", "hinauf", "hinaus", "hinein", "hinten", "hinterher", "hinüber", "hinunter", 
      "daran", "darauf", "daraus", "darin", "darüber", "darum", "darunter", 
      "dazu", "dahinter", "dazwischen", "empor", "entgegen", "gegenüber", 
      "zusammen", "zurück", "entlang", "fehl", "gleich", "hoch", "statt", "teil", 
      "durch", "über", "um", "unter", "voll", "wider", "wieder",
      // Adjectives/Other categories
      "bereit", "blank", "feil", "fertig", "fremd", "glatt", "gut", "inne", "irre", "kund", "leer", "nahe", "offen", "richtig", "schief", "schwer", "umher", "wahr", "wert",
      "acht", "halt", "maß", "wett", "wort", "zurecht", "zugute", "zuwider", "zwischen",
      "beieinander", "durcheinander", "miteinander", "nebeneinander", "übereinander", "untereinander", "voneinander"
    ]);

    const sentences = text.match(/[^.!?\n]+[.!?\n]+/g) || [text];
    const candidates = [];
    const seen = new Set();
    const consumedFragments = new Set(); // Track parts used in separable verbs

    for (const sentence of sentences) {
      // Basic tokenization keeping words
      const tokens = sentence
        .replace(/[^A-Za-zÄÖÜäöüß\-\s]/g, ' ')
        .split(/\s+/)
        .filter(t => t.length > 0);

      if (tokens.length < 3) continue;

      const lastToken = tokens[tokens.length - 1].toLowerCase();
      
      // 【优化】过滤常见的介词缩写，防止误判为可分前缀
      // zum (zu dem), zur (zu der), beim (bei dem), vom (von dem), im (in dem), am (an dem)
      if (['zum', 'zur', 'beim', 'vom', 'im', 'am', 'ans', 'ins'].includes(lastToken)) continue;

      if (SEPARABLE_PREFIXES.has(lastToken)) {
        // Scan sentence for verb root (skip last token)
        for (let i = 0; i < tokens.length - 1; i++) {
          const word = tokens[i];
          // Skip short words to save lookup time, but keep short verbs like "tut", "hat"
          if (word.length < 2) continue;

          // 【优化】过滤掉明显不是动词的高频词 (Macht -> Power 误判问题)
          // 这里的 stop 集合包含了 "macht" (名词 Power) 但小写的 "macht" (动词 machen) 也可能被过滤
          // 实际上 "Macht" (大写) 是名词，"macht" (小写) 是动词。
          // 简单的规则：如果句子里的词是首字母大写（且不是句首），大概率是名词，直接跳过。
          if (i > 0 && /^[A-ZÄÖÜ]/.test(word)) continue; 

          try {
            // Check if 'word' is a verb form
            const res = await unifiedSearch.search(word, { enableCloud: false });
            if (res.found && res.entries && res.entries.length > 0) {
              const entry = res.entries[0];
              // Assuming entries are lemmas. If word is "fügt", entry is "fügen".
              const lemma = entry.w;
              
              // 【新增校验】：确保找到的原型真的是动词
              // 检查 entry.p (part of speech) 是否为 'verb' 或 'v'
              // 如果字典数据没有 p 字段，只能由后续步骤兜底
              if (entry.p && !entry.p.toLowerCase().includes('verb') && entry.p !== 'v') {
                  continue;
              }

              // Simple check: if lemma is significantly different or known verb
              // Ideally we check POS, but 'p' field availability varies.
              // Let's assume if it conjugates (lemma != word) or is common verb, it's a candidate.
              
              const combined = lastToken + lemma;
              
              // Validate combined verb
              if (!seen.has(combined)) {
                const combinedRes = await unifiedSearch.search(combined, { enableCloud: false });
                if (combinedRes.found) {
                   candidates.push({
                     word: combined,
                     trScore: 2.0 // Boost score for discovered separable verbs (higher than typical TextRank < 1.0)
                   });
                   seen.add(combined);
                   
                   // Mark fragments as consumed
                   consumedFragments.add(word.toLowerCase()); // The conjugated verb (e.g. "lädt")
                   consumedFragments.add(lemma.toLowerCase()); // The root verb (e.g. "laden")
                   consumedFragments.add(lastToken.toLowerCase()); // The prefix (e.g. "herunter")
                }
              }
            }
          } catch (e) {
            // ignore errors
          }
        }
      }
    }
    return { candidates, consumedFragments };
  }
}


const aiService = new AIService();

export { aiService };
