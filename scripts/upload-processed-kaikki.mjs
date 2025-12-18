import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const SUPABASE_URL = process.env['SUPABASE_URL'] || process.env.REACT_APP_SUPABASE_URL || 'https://dodsisnlvmpvipgsvzid.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.REACT_APP_SUPABASE_ANON_KEY;

const DICT_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Kaikki_Dict_Output.json');
const LEMMA_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/lemma/Kaikki_Lemma_Output.json');
const COMMON_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Common_Vocab_local.json');
const RARE_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/Rare_Vocab_cloud.json');
const COLLISIONS_REPORT_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/lemma/Kaikki_Hash_Collisions.json');

const BATCH_SIZE = 1000;

const canUpload = !!SUPABASE_KEY;
const supabase = canUpload ? createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
}) : null;

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

    return { winner: enriched[0], losers: enriched.slice(1) };
}

async function getExistingRowsById(ids) {
    if (!canUpload) return new Map();
    if (!ids.length) return new Map();
    const { data, error } = await supabase
        .from('dictionary')
        .select('id, word, pos, rank')
        .in('id', ids);
    if (error) {
        console.error('❌ Failed to query existing dictionary ids:', error.message);
        return new Map();
    }
    return new Map((data || []).map(r => [r.id, r]));
}

async function uploadData() {
    console.log('🚀 Starting upload to Supabase...');

    if (fs.existsSync(DICT_FILE)) {
        console.log(`\n📂 Reading Dictionary File: ${DICT_FILE}`);
        
        try {
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

            const collisions = [];
            const winners = [];

            for (const [id, entries] of byId.entries()) {
                if (entries.length === 1) {
                    winners.push(entries[0]);
                    continue;
                }
                const { winner, losers } = pickWinnerByRank(entries, rankMap);
                winners.push(winner.entry);
                collisions.push({
                    id,
                    winner: {
                        word: winner.entry.word,
                        pos: winner.entry.pos,
                        rank: winner.rank
                    },
                    losers: losers.map(l => ({
                        word: l.entry.word,
                        pos: l.entry.pos,
                        rank: l.rank
                    }))
                });
            }

            if (collisions.length > 0) {
                fs.mkdirSync(path.dirname(COLLISIONS_REPORT_FILE), { recursive: true });
                fs.writeFileSync(COLLISIONS_REPORT_FILE, JSON.stringify({
                    generated_at: new Date().toISOString(),
                    collision_count: collisions.length,
                    collisions
                }, null, 2));
                console.log(`⚠️ Hash collisions found: ${collisions.length.toLocaleString()}`);
                console.log(`🧾 Collision report: ${COLLISIONS_REPORT_FILE}`);
            } else {
                console.log('✅ No hash collisions detected in input.');
            }

            console.log(`📦 After collision filtering: ${winners.length.toLocaleString()} dictionary entries`);

            if (!canUpload) {
                console.log(`❌ Missing env var: SUPABASE_SERVICE_KEY`);
                console.log(`🧾 Collision report: ${COLLISIONS_REPORT_FILE}`);
                return;
            }

            let totalInsertedAttempt = 0;
            let totalSkippedPk = 0;
            let totalSkippedExistingId = 0;
            let totalSkippedExistingIdMismatch = 0;
            for (let i = 0; i < winners.length; i += BATCH_SIZE) {
                const batch = winners.slice(i, i + BATCH_SIZE).filter(Boolean);

                const batchById = new Map();
                for (const row of batch) {
                    if (!row || row.id === undefined || row.id === null) continue;
                    if (!batchById.has(row.id)) batchById.set(row.id, row);
                }
                const dedupedBatch = [...batchById.values()];

                const ids = dedupedBatch.map(r => r.id);
                const existingRows = await getExistingRowsById(ids);

                const newRows = [];
                for (const r of dedupedBatch) {
                    const existing = existingRows.get(r.id);
                    if (!existing) {
                        newRows.push(r);
                        continue;
                    }
                    totalSkippedExistingId++;
                    const sameWordPos =
                        normalizeWord(existing.word) === normalizeWord(r.word) &&
                        normalizePos(existing.pos) === normalizePos(r.pos);
                    if (!sameWordPos) {
                        totalSkippedExistingIdMismatch++;
                    }
                }

                totalSkippedPk += (dedupedBatch.length - newRows.length);

                if (newRows.length === 0) {
                    continue;
                }

                const { error } = await supabase
                    .from('dictionary')
                    .upsert(newRows, { onConflict: 'id', ignoreDuplicates: true });

                if (error) {
                    console.error(`❌ Error uploading dictionary batch ${i}:`, error.message);
                } else {
                    totalInsertedAttempt += newRows.length;
                    process.stdout.write(
                        `\r📤 Dictionary inserted: ${totalInsertedAttempt.toLocaleString()} | pk-skipped: ${totalSkippedPk.toLocaleString()} | existing-id: ${totalSkippedExistingId.toLocaleString()} | existing-id-mismatch: ${totalSkippedExistingIdMismatch.toLocaleString()}`
                    );
                }
            }
            console.log('\n✅ Dictionary upload completed.');
        } catch (err) {
            console.error('❌ Error reading/parsing dictionary file:', err.message);
        }
    } else {
        console.warn(`⚠️ Dictionary file not found: ${DICT_FILE}`);
    }

    if (fs.existsSync(LEMMA_FILE)) {
        console.log(`\n📂 Reading Lemma File: ${LEMMA_FILE}`);
        try {
            const rawData = fs.readFileSync(LEMMA_FILE, 'utf-8');
            const lemmaData = JSON.parse(rawData);
            console.log(`✅ Loaded ${lemmaData.length.toLocaleString()} lemma entries.`);

            let totalInsertedAttempt = 0;
            let totalSkippedFk = 0;
            
            for (let i = 0; i < lemmaData.length; i += BATCH_SIZE) {
                const batch = lemmaData.slice(i, i + BATCH_SIZE).filter(Boolean);

                const uniqueMap = new Map();
                for (const row of batch) {
                    if (!row || !row.variant || row.lemma_id === undefined || row.lemma_id === null) continue;
                    const key = `${row.variant}::${row.lemma_id}`;
                    if (!uniqueMap.has(key)) uniqueMap.set(key, row);
                }
                const uniqueBatch = [...uniqueMap.values()];

                const lemmaIds = [...new Set(uniqueBatch.map(r => r.lemma_id))];
                const existingLemmaRows = await getExistingRowsById(lemmaIds);
                const filteredBatch = uniqueBatch.filter(r => existingLemmaRows.has(r.lemma_id));
                totalSkippedFk += (uniqueBatch.length - filteredBatch.length);

                if (filteredBatch.length === 0) {
                    continue;
                }

                const { error } = await supabase
                    .from('search_index')
                    .upsert(filteredBatch, { onConflict: 'variant, lemma_id', ignoreDuplicates: true });

                if (error) {
                    console.error(`❌ Error uploading lemma batch ${i}:`, error.message);
                } else {
                    totalInsertedAttempt += filteredBatch.length;
                    process.stdout.write(`\r📤 Lemmas upserted: ${totalInsertedAttempt.toLocaleString()} | fk-skipped: ${totalSkippedFk.toLocaleString()}`);
                }
            }
            console.log('\n✅ Lemma upload completed.');
        } catch (err) {
            console.error('❌ Error reading/parsing lemma file:', err.message);
        }
    } else {
        console.warn(`⚠️ Lemma file not found: ${LEMMA_FILE}`);
    }
}

uploadData().catch(console.error);
