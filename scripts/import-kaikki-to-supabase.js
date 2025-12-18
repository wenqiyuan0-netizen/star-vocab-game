
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import readline from 'readline';
import path from 'path';

// Configuration
const SUPABASE_URL = process.env['SUPABASE_URL'] || 'https://dodsisnlvmpvipgsvzid.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const INPUT_FILE = "C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\kaikki.org-dictionary-German.jsonl";
const BATCH_SIZE = 500; // Conservative batch size

if (!SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing env var: SUPABASE_SERVICE_KEY');
    process.exit(1);
}

if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
}

// Initialize Supabase
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

// Helper: Generate Stable ID (Must match frontend logic)
function generateStableId(word, pos) {
    const signature = `${word}:${pos}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
        const char = signature.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash);
}

// Helper: Extract English translations
function extractTranslations(senses) {
    if (!senses || !Array.isArray(senses)) return '';
    return senses
        .map(s => s.glosses ? s.glosses.join('; ') : '')
        .filter(t => t)
        .slice(0, 5) // Limit to top 5 senses to save space
        .join(' | ');
}

// Helper: Extract audio/IPA
function extractSound(sounds) {
    let ipa = '';
    let audio = '';
    if (sounds && Array.isArray(sounds)) {
        const ipaObj = sounds.find(s => s.ipa);
        if (ipaObj) ipa = ipaObj.ipa;
        
        const audioObj = sounds.find(s => s.audio || s.mp3_url || s.ogg_url);
        if (audioObj) {
            audio = audioObj.mp3_url || audioObj.ogg_url || '';
        }
    }
    return { ipa, audio };
}

async function processLineByLine() {
    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let dictBuffer = [];
    let indexBuffer = [];
    let totalProcessed = 0;
    let totalImported = 0;

    console.log('🚀 Starting import from Kaikki...');

    for await (const line of rl) {
        try {
            if (!line.trim()) continue;
            const entry = JSON.parse(line);
            
            // Skip invalid entries
            if (!entry.word || !entry.pos) continue;

            const id = generateStableId(entry.word, entry.pos);
            const translation = extractTranslations(entry.senses);
            const { ipa, audio } = extractSound(entry.sounds);

            // Prepare dictionary entry
            const dictItem = {
                id: id,
                word: entry.word,
                pos: entry.pos,
                translation: translation,
                // translation_cn: '', // Empty for now
                ipa: ipa,
                audio: audio,
                source: 'kaikki_cloud',
                example_de: '', // Could extract from examples if needed
                example_cn: ''
            };

            dictBuffer.push(dictItem);

            // Prepare search index entries (variants)
            if (entry.forms && Array.isArray(entry.forms)) {
                for (const form of entry.forms) {
                    if (form.form && form.form !== entry.word) {
                        indexBuffer.push({
                            variant: form.form.toLowerCase(),
                            lemma_id: id
                        });
                    }
                }
            }

            // Flush buffers if full
            if (dictBuffer.length >= BATCH_SIZE) {
                await flushBuffers(dictBuffer, indexBuffer);
                totalImported += dictBuffer.length;
                dictBuffer = [];
                indexBuffer = []; // Clear index buffer too
                if (global.gc) global.gc(); // Optional: Help GC
            }

            totalProcessed++;
            if (totalProcessed % 1000 === 0) {
                process.stdout.write(`\rProcessed: ${totalProcessed.toLocaleString()} | Imported: ${totalImported.toLocaleString()}`);
            }

        } catch (err) {
            console.error('\n❌ Error processing line:', err.message);
        }
    }

    // Flush remaining
    if (dictBuffer.length > 0) {
        await flushBuffers(dictBuffer, indexBuffer);
        totalImported += dictBuffer.length;
    }

    console.log(`\n\n✅ Import completed! Total records: ${totalImported.toLocaleString()}`);
}

async function flushBuffers(dictItems, indexItems) {
    // 1. Upsert Dictionary Items
    if (dictItems.length > 0) {
        const { error: dictError } = await supabase
            .from('dictionary')
            .upsert(dictItems, { onConflict: 'id', ignoreDuplicates: true }); // Use ignoreDuplicates to avoid overwriting existing good data if any
        
        if (dictError) {
            console.error('\n❌ Dictionary Batch Error:', dictError.message);
        }
    }

    // 2. Upsert Search Index Items
    // Deduplicate index items first (variant + lemma_id)
    if (indexItems.length > 0) {
        const uniqueIndices = Array.from(new Set(indexItems.map(i => JSON.stringify(i)))).map(s => JSON.parse(s));
        
        // Supabase might time out with too many index items, split if necessary
        // But BATCH_SIZE 500 should be fine even with multiple forms
        
        const { error: indexError } = await supabase
            .from('search_index')
            .upsert(uniqueIndices, { onConflict: 'variant, lemma_id', ignoreDuplicates: true });

        if (indexError) {
            // It's possible 'variant, lemma_id' is not a unique constraint, usually it's just ID or variant?
            // If search_index doesn't have a unique constraint on (variant, lemma_id), this might fail or duplicate.
            // Assuming the table allows duplicates or has a constraint.
            // If it fails, we log it.
            console.error('\n❌ Search Index Batch Error:', indexError.message);
        }
    }
}

processLineByLine().catch(console.error);
