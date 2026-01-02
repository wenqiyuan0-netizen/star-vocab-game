const fs = require('fs');
const readline = require('readline');
const path = require('path');

const KAIKKI_PATH = 'C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\kaikki.org-dictionary-German.jsonl';
const COMMON_DICT_PATH = path.join(__dirname, '../public/dict/common_2500.json');
const OUTPUT_DIR = path.join(__dirname, '../public/dict');
const OUTPUT_CONJUGATIONS = path.join(OUTPUT_DIR, 'conjugations.json');
const OUTPUT_VARIANTS = path.join(OUTPUT_DIR, 'local_variants.json');

async function processKaikki() {
    console.log('Loading common dictionary...');
    const commonDict = JSON.parse(fs.readFileSync(COMMON_DICT_PATH, 'utf8'));
    
    // Create a Set of target words for fast lookup
    // Normalize to lower case for checking, but keep original for mapping
    const targetWords = new Set(commonDict.map(entry => entry.word));
    const targetWordsLower = new Set(commonDict.map(entry => entry.word.toLowerCase()));

    console.log(`Found ${targetWords.size} target words.`);

    const conjugations = {};
    const variants = {};

    console.log('Reading Kaikki file...');
    
    const fileStream = fs.createReadStream(KAIKKI_PATH);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let count = 0;
    let foundCount = 0;

    for await (const line of rl) {
        count++;
        if (count % 100000 === 0) console.log(`Processed ${count} lines...`);

        try {
            const entry = JSON.parse(line);
            const word = entry.word;
            
            if (!word) continue;

            // 1. Extract Conjugation/Declension for Target Words
            if (targetWords.has(word)) {
                // Check if this entry has forms
                // Kaikki structure varies, but usually 'forms' or 'senses' contain info. 
                // However, Kaikki JSONL usually has specific fields for structured data like 'forms' is not always the table.
                // Actually, Kaikki puts generated forms in 'forms' array, but often for verbs it might not have the full table in a simple way.
                // Let's inspect what we can get. 
                // For the "Conjugation Table", we usually want the 'forms' list which contains objects like { "form": "lernte", "tags": ["past", "singular", ...] }
                
                    if (entry.forms && Array.isArray(entry.forms)) {
                        if (!conjugations[word]) {
                            conjugations[word] = [];
                        }
                        // Only add unique forms to avoid duplicates
                        const existingForms = new Set(conjugations[word].map(f => f.form));
                        
                        entry.forms.forEach(form => {
                            if (form.form && !existingForms.has(form.form)) {
                                conjugations[word].push(form);
                                existingForms.add(form.form);
                                
                                // Populate variants map
                                if (typeof form.form === 'string') {
                                    const variantForm = form.form;
                                    if (variantForm !== word) {
                                        variants[variantForm.toLowerCase()] = word;
                                    }
                                }
                            }
                        });
                        
                        if (entry.forms.length > 0) {
                            foundCount++;
                        }
                    }
            }
        } catch (e) {
            console.error('Error parsing line:', e);
        }
    }

    console.log(`Finished processing. Found forms for ${Object.keys(conjugations).length} words.`);
    console.log(`Generated ${Object.keys(variants).length} variant mappings.`);

    // Save outputs
    console.log('Writing output files...');
    
    // Save variants (keep as one file for now, or split if needed)
    fs.writeFileSync(OUTPUT_VARIANTS, JSON.stringify(variants, null, 2));

    // Save conjugations split by first letter
    const CONJ_DIR = path.join(OUTPUT_DIR, 'conjugations');
    if (!fs.existsSync(CONJ_DIR)) {
        fs.mkdirSync(CONJ_DIR, { recursive: true });
    }

    const chunks = {};
    for (const [word, data] of Object.entries(conjugations)) {
        const firstChar = word.charAt(0).toLowerCase();
        // Handle umlauts or other chars if necessary, but generally:
        // a-z, and maybe 'ä' -> 'a', etc? 
        // Let's just use the char code or a safe filename map.
        let safeChar = firstChar;
        if (/[^a-z0-9]/.test(safeChar)) {
            // Map umlauts
            const map = { 'ä': 'a', 'ö': 'o', 'ü': 'u', 'ß': 's' };
            safeChar = map[safeChar] || 'other';
        }
        
        if (!chunks[safeChar]) chunks[safeChar] = {};
        chunks[safeChar][word] = data;
    }

    for (const [char, data] of Object.entries(chunks)) {
        const filePath = path.join(CONJ_DIR, `${char}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data)); // Minified to save space
        console.log(`Saved ${char}.json (${Object.keys(data).length} words)`);
    }
    
    console.log('Done!');
}

processKaikki().catch(console.error);
