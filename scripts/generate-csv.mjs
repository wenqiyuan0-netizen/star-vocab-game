import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DICT_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Kaikki_Dict_Output.json');
const COMMON_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Common_Vocab_local.json');
const RARE_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Rare_Vocab_cloud.json');
const OUTPUT_CSV_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Kaikki_Dict_Cleaned.csv');

function normalizeWord(s) {
    if (!s || typeof s !== 'string') return '';
    return s.toLowerCase().trim();
}

function normalizePos(s) {
    if (!s || typeof s !== 'string') return '';
    return s.toLowerCase().trim();
}

function makeRankMap() {
    const rankMap = new Map();

    const addFile = (filePath) => {
        if (!fs.existsSync(filePath)) return;
        const rows = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        if (!Array.isArray(rows)) return;
        for (const r of rows) {
            const w = normalizeWord(r.word);
            const p = normalizePos(r.pos);
            if (!w || !p) continue;
            const rank = Number.isFinite(r.rank) ? r.rank : null;
            if (rank === null) continue;
            const key = `${w}:${p}`;
            const existing = rankMap.get(key);
            if (existing === undefined || rank < existing) {
                rankMap.set(key, rank);
            }
        }
    };

    addFile(COMMON_FILE);
    addFile(RARE_FILE);

    return rankMap;
}

function pickWinnerByRank(entries, rankMap) {
    const enriched = entries.map(e => {
        const w = normalizeWord(e.word);
        const p = normalizePos(e.pos);
        const key = `${w}:${p}`;
        const rank = rankMap.has(key) ? rankMap.get(key) : null;
        return { entry: e, rank };
    });

    enriched.sort((a, b) => {
        const aHas = a.rank !== null && a.rank !== undefined;
        const bHas = b.rank !== null && b.rank !== undefined;
        if (aHas !== bHas) return aHas ? -1 : 1;
        if (aHas && bHas && a.rank !== b.rank) return a.rank - b.rank;
        const aw = normalizeWord(a.entry.word);
        const bw = normalizeWord(b.entry.word);
        if (aw !== bw) return aw.localeCompare(bw, 'de');
        const ap = normalizePos(a.entry.pos);
        const bp = normalizePos(b.entry.pos);
        return ap.localeCompare(bp);
    });

    return enriched[0].entry;
}

function escapeCsvField(field) {
    if (field === null || field === undefined) {
        return '';
    }
    const stringField = String(field);
    if (stringField.includes(',') || stringField.includes('"') || stringField.includes('\n') || stringField.includes('\r')) {
        return `"${stringField.replace(/"/g, '""')}"`;
    }
    return stringField;
}

async function generateCsv() {
    console.log('🚀 Starting CSV generation...');

    if (!fs.existsSync(DICT_FILE)) {
        console.error(`❌ Dictionary file not found: ${DICT_FILE}`);
        return;
    }

    console.log(`\n📂 Reading Dictionary File: ${DICT_FILE}`);
    const rawData = fs.readFileSync(DICT_FILE, 'utf-8');
    const dictData = JSON.parse(rawData);
    console.log(`✅ Loaded ${dictData.length.toLocaleString()} dictionary entries.`);

    const rankMap = makeRankMap();
    console.log(`📌 Rank map loaded: ${rankMap.size.toLocaleString()} entries`);

    const byId = new Map();
    for (const row of dictData) {
        if (!row || row.id === undefined || row.id === null) continue;
        if (!byId.has(row.id)) byId.set(row.id, []);
        byId.get(row.id).push(row);
    }

    const winners = [];
    let collisionCount = 0;

    for (const entries of byId.values()) {
        if (entries.length === 1) {
            winners.push(entries[0]);
        } else {
            collisionCount++;
            const winner = pickWinnerByRank(entries, rankMap);
            winners.push(winner);
        }
    }

    console.log(`⚠️ Collisions resolved: ${collisionCount.toLocaleString()}`);
    console.log(`📦 Final CSV rows: ${winners.length.toLocaleString()}`);

    // CSV Headers based on Supabase table schema
    const headers = [
        'id', 'word', 'pos', 'translation', 'rank', 'freq', 
        'article', 'plural', 'audio', 'ipa', 
        'translation_cn', 'example_de', 'example_cn', 
        'source', 'created_at'
    ];

    const csvStream = fs.createWriteStream(OUTPUT_CSV_FILE, { encoding: 'utf8' });
    
    // Write BOM for Excel compatibility (optional but good practice)
    csvStream.write('\ufeff');
    
    // Write header
    csvStream.write(headers.join(',') + '\n');

    for (const row of winners) {
        const values = headers.map(header => {
            // Special handling for JSON fields if they are objects/arrays in JSON
            // But here most fields seem to be strings or numbers.
            // Check if any field is an object/array and needs stringify?
            // Based on previous JSON, they seem flat.
            // Let's just use the raw value.
            let val = row[header];
            
            // If created_at is missing, maybe leave it empty or use current date?
            // Supabase usually defaults created_at to now() if missing, but for CSV it might be better to skip or provide.
            // If we provide empty string, Supabase might handle it if nullable or default.
            
            return escapeCsvField(val);
        });
        csvStream.write(values.join(',') + '\n');
    }

    csvStream.end();

    console.log(`✅ CSV generated at: ${OUTPUT_CSV_FILE}`);
}

generateCsv().catch(console.error);
