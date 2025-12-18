import fs from 'fs';
import readline from 'readline';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT_FILE = "C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\kaikki.org-dictionary-German.jsonl";
const OUTPUT_DIR = path.join(__dirname, '../src/shared/services/dictionary/dict');
const LEMMA_DIR = path.join(OUTPUT_DIR, 'lemma');
const OUTPUT_DICT_FILE = path.join(OUTPUT_DIR, 'Kaikki_Dict_Output.json');
const OUTPUT_LEMMA_FILE = path.join(LEMMA_DIR, 'Kaikki_Lemma_Output.json');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(LEMMA_DIR)) {
    fs.mkdirSync(LEMMA_DIR, { recursive: true });
}

if (!fs.existsSync(INPUT_FILE)) {
    console.error(`❌ Input file not found: ${INPUT_FILE}`);
    process.exit(1);
}

function generateStableId(word, pos) {
    const signature = `${word}:${pos}`.toLowerCase();
    let hash = 0;
    for (let i = 0; i < signature.length; i++) {
        const char = signature.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash;
    }
    return Math.abs(hash);
}

function extractTranslations(senses) {
    if (!senses || !Array.isArray(senses)) return '';
    return senses
        .map(s => s.glosses ? s.glosses.join('; ') : '')
        .filter(t => t)
        .slice(0, 5)
        .join(' | ');
}

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

    let dictCount = 0;
    let lemmaCount = 0;
    
    const dictStream = fs.createWriteStream(OUTPUT_DICT_FILE, { flags: 'w' });
    const lemmaStream = fs.createWriteStream(OUTPUT_LEMMA_FILE, { flags: 'w' });

    dictStream.write('[\n');
    lemmaStream.write('[\n');

    let isFirstDict = true;
    let isFirstLemma = true;

    console.log('🚀 Starting local processing of Kaikki data...');
    console.log(`📂 Input: ${INPUT_FILE}`);
    console.log(`📂 Output Dict: ${OUTPUT_DICT_FILE}`);
    console.log(`📂 Output Lemma: ${OUTPUT_LEMMA_FILE}`);

    for await (const line of rl) {
        try {
            if (!line.trim()) continue;
            const entry = JSON.parse(line);
            
            if (!entry.word || !entry.pos) continue;

            const id = generateStableId(entry.word, entry.pos);
            const translation = extractTranslations(entry.senses);
            const { ipa, audio } = extractSound(entry.sounds);

            const dictItem = {
                id: id,
                word: entry.word,
                pos: entry.pos,
                translation: translation,
                translation_cn: '',
                ipa: ipa,
                audio: audio,
                source: 'kaikki_cloud',
                example_de: '', 
                example_cn: ''
            };

            if (!isFirstDict) dictStream.write(',\n');
            dictStream.write(JSON.stringify(dictItem, null, 2));
            isFirstDict = false;
            dictCount++;

            if (entry.forms && Array.isArray(entry.forms)) {
                for (const form of entry.forms) {
                    if (form.form && form.form !== entry.word) {
                        const lemmaItem = {
                            variant: form.form.toLowerCase(),
                            lemma_id: id
                        };

                        if (!isFirstLemma) lemmaStream.write(',\n');
                        lemmaStream.write(JSON.stringify(lemmaItem, null, 2));
                        isFirstLemma = false;
                        lemmaCount++;
                    }
                }
            }

            if (dictCount % 5000 === 0) {
                process.stdout.write(`\rProcessed: ${dictCount.toLocaleString()} words | ${lemmaCount.toLocaleString()} lemmas`);
            }

        } catch (err) {
            console.error('\n❌ Error processing line:', err.message);
        }
    }

    dictStream.write('\n]');
    lemmaStream.write('\n]');

    dictStream.end();
    lemmaStream.end();

    console.log(`\n\n✅ Processing completed!`);
    console.log(`📚 Dictionary entries: ${dictCount.toLocaleString()}`);
    console.log(`🔗 Lemma entries: ${lemmaCount.toLocaleString()}`);
}

processLineByLine().catch(console.error);
