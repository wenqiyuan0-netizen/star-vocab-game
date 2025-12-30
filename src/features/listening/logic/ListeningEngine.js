
/**
 * ListeningEngine.js
 * 
 * Core logic for the Listening Mode:
 * 1. Word Selection (Deck generation)
 * 2. Cloze Challenge Builder
 * 3. Answer Settlement
 */

// --- Word Selection ---

export function selectNextWord(globalWordDb, dailyStats, settings) {
    // Strategy: Priority from "Bonus Mode" logic in DeckGenerator
    // 1. High Proficiency words (interval > 7 days)
    // 2. Today's Due words (if any left)
    // 3. New words (as filler)
    
    // Filter valid candidates (must have examples for cloze generation)
    // Actually, we can generate simple audio even without examples, but cloze needs context usually.
    // If no examples, we might skip or use a simple "spell the word" mode.
    // For V1, let's prefer words with examples.
    
    // RELAXED FILTER: Allow all words, but prioritize those with examples later.
    // If globalWordDb is empty, we return null immediately.
    if (!globalWordDb || globalWordDb.length === 0) return null;

    // Filter out invalid words (must have 'word' property)
    const validWords = globalWordDb.filter(w => w && w.word);
    if (validWords.length === 0) return null;

    let candidates = validWords.filter(w => 
        w.state !== 'new' || (w.examples && w.examples.length > 0)
    );
    
    // Fallback: If strict filtering leaves us with nothing, use ANY valid word.
    if (candidates.length === 0) {
        candidates = validWords;
    }
    
    if (candidates.length === 0) return null;

    // Prioritize High Proficiency (Interval > 7)
    const highProf = candidates.filter(w => (w.interval || 0) > 7);
    const lowProf = candidates.filter(w => (w.interval || 0) <= 7 && w.state !== 'new');
    const newWords = candidates.filter(w => w.state === 'new');

    // Probability Weights: High=50%, Low=30%, New=20%
    const rand = Math.random();
    let selectedPool = [];

    if (rand < 0.5 && highProf.length > 0) {
        selectedPool = highProf;
    } else if (rand < 0.8 && lowProf.length > 0) {
        selectedPool = lowProf;
    } else if (newWords.length > 0) {
        selectedPool = newWords;
    } else {
        // Fallback
        selectedPool = [...highProf, ...lowProf, ...newWords];
    }

    if (selectedPool.length === 0) selectedPool = candidates;

    // Pick one random word from the pool
    const word = selectedPool[Math.floor(Math.random() * selectedPool.length)];
    return word;
}


// --- Cloze Generation ---

export function buildClozeChallenge(word, difficultyLevel = 0) {
    // Safety check
    if (!word || !word.word) {
        console.warn('buildClozeChallenge received invalid word:', word);
        return null;
    }

    // word: { word, translation, example_de, example_cn, ... }
    
    // 1. Select Content
    // Support both new flat format (RPC) and legacy array format
    let sentence = word.example_de || null;
    let sentenceTranslation = word.example_cn || null;
    
    if (!sentence && word.examples && word.examples.length > 0) {
        const ex = word.examples[Math.floor(Math.random() * word.examples.length)];
        sentence = ex?.de || null;
        sentenceTranslation = ex?.cn || null;
    }

    // Fallback if no example
    if (!sentence) {
        sentence = word.word;
        sentenceTranslation = word.translation;
        difficultyLevel = 0; // Force easy if no context
    }

    // Ensure sentence is a string to prevent .match() errors
    if (typeof sentence !== 'string') {
        sentence = String(sentence || "");
    }

    // 2. Identify Target in Sentence
    const escapedWord = (word.word || "").replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Strategy 1: Exact Match (Whole word)
    let regex = new RegExp(`\\b${escapedWord}\\b`, 'i');
    let match = sentence.match(regex);

    // Strategy 2: Prefix Match (Handles declensions like 'Hause', 'Hauses', 'Hausaufgabe')
    // We match the word boundary at start, then the word, then optional suffix characters.
    if (!match) {
        // [a-zäöüß]* matches German letters. 
        regex = new RegExp(`\\b${escapedWord}[a-zäöüß]*`, 'i');
        match = sentence.match(regex);
    }
    
    // Strategy 3: Relaxed Match (If word is long enough, match anywhere)
    // Useful for compound words where the target is in the middle/end (e.g. 'Bahn' in 'Autobahn')
    // Only apply if word length > 3 to avoid matching 'in', 'an', 'es' everywhere.
    if (!match && word.word.length > 3) {
        regex = new RegExp(`${escapedWord}`, 'i');
        match = sentence.match(regex);
    }

    let answer = word.word;
    let parts = [];
    let challengeType = 'cloze'; // standard

    if (match) {
        answer = match[0]; // Case-preserved actual word in sentence
        const index = match.index;
        const pre = sentence.substring(0, index);
        const post = sentence.substring(index + answer.length);

        // 3. Apply Difficulty Logic
        if (difficultyLevel === 0) {
            // Easy: Partial Masking (Hide random letters or syllables)
            // Strategy: Hide 40-50% of characters, keeping first/last if possible
            const chars = answer.split('');
            const maskedIndices = new Set();
            const maskCount = Math.max(1, Math.floor(chars.length * 0.5));
            
            while (maskedIndices.size < maskCount) {
                const idx = Math.floor(Math.random() * chars.length);
                // Try not to mask the first char if len > 3
                if (chars.length > 3 && idx === 0) continue; 
                maskedIndices.add(idx);
            }
            
            // Construct a "hinted" answer for display (e.g., "H_u_e")
            // But for the UI cloze input, we usually expect the full word.
            // Wait, if it's partial, the user might only need to type missing letters?
            // Or type the whole word but seeing hints?
            // "Type the whole word" is better for muscle memory.
            // So we show "H _ u _ e" as placeholder or context?
            // Let's make the 'cloze' part in UI display the hint.
            
            const hintStr = chars.map((c, i) => maskedIndices.has(i) ? '_' : c).join('');
            
            parts = [
                { text: pre, type: 'text' },
                { text: answer, type: 'cloze', hint: hintStr }, // UI should use hint if provided
                { text: post, type: 'text' }
            ];
            
        } else if (difficultyLevel === 1) {
            // Normal: Full word hidden
             parts = [
                { text: pre, type: 'text' },
                { text: answer, type: 'cloze', hint: '___' },
                { text: post, type: 'text' }
            ];
            
        } else {
            // Hard: Translation / Audio Only
            // Hide the German sentence text, show Chinese translation
            challengeType = 'translation_hard';
            parts = [
                { text: answer, type: 'cloze' } // No surrounding text shown
            ];
        }
    } else {
        // Fallback: Word Spelling
        challengeType = 'spelling';
        const chars = word.word.split('');
        const maskCount = Math.ceil(chars.length / 2);
        const maskedIndices = new Set();
        while (maskedIndices.size < maskCount) maskedIndices.add(Math.floor(Math.random() * chars.length));
        const hintStr = chars.map((c, i) => maskedIndices.has(i) ? '_' : c).join('');
        
        parts = [{ text: word.word, type: 'cloze', hint: hintStr }];
    }

    return {
        id: crypto.randomUUID(),
        wordId: word.id,
        word: word.word,
        type: challengeType,
        sentence,
        sentenceTranslation,
        parts,
        answer,
        wordInfo: word,
        hintLevel: 0,
        difficulty: difficultyLevel
    };
}

// --- Answer Checking ---

export function checkAnswer(challenge, input) {
    const normalize = (s) => s.trim().toLowerCase();
    const isCorrect = normalize(input) === normalize(challenge.answer);
    
    // Calculate Score
    // Base score: 10
    // Penalties: Hint used?
    let score = 10; 
    let charsEarned = challenge.answer.length * 10; // 1 char = 10 points for progress? Or 1 char = 1 char?
    // Design doc says: "Earn word count". So charsEarned = length of word.
    
    if (!isCorrect) {
        score = 0;
        charsEarned = 0;
    }

    return {
        isCorrect,
        score,
        charsEarned
    };
}
