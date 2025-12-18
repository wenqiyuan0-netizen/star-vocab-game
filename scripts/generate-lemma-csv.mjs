import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const LEMMA_FILE = path.join(__dirname, '../src/shared/services/dictionary/dict/lemma/Kaikki_Lemma_Output.json');
const DICT_CLEANED_CSV = path.join(__dirname, '../src/shared/services/dictionary/dict/Kaikki_Dict_Cleaned.csv');
const OUTPUT_LEMMA_CSV = path.join(__dirname, '../src/shared/services/dictionary/dict/Kaikki_Lemma_Cleaned.csv');

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

async function generateLemmaCsv() {
    console.log('🚀 Starting Lemma CSV generation...');

    if (!fs.existsSync(LEMMA_FILE)) {
        console.error(`❌ Lemma file not found: ${LEMMA_FILE}`);
        return;
    }

    // Load valid IDs from the cleaned dictionary CSV to ensure foreign key integrity
    // We only want to upload lemmas for words that actually exist in our cleaned dictionary
    console.log('📂 Loading valid IDs from Dictionary CSV...');
    const validIds = new Set();
    if (fs.existsSync(DICT_CLEANED_CSV)) {
        const content = fs.readFileSync(DICT_CLEANED_CSV, 'utf-8');
        const lines = content.split('\n');
        // Skip header (index 0)
        for (let i = 1; i < lines.length; i++) {
            const line = lines[i];
            if (!line.trim()) continue;
            // CSV parsing: Assuming simple CSV without internal commas for IDs.
            // ID is the first column.
            const firstComma = line.indexOf(',');
            if (firstComma !== -1) {
                const id = line.substring(0, firstComma).replace(/"/g, '');
                validIds.add(Number(id));
            }
        }
        console.log(`✅ Loaded ${validIds.size.toLocaleString()} valid dictionary IDs.`);
    } else {
        console.warn('⚠️ Cleaned Dictionary CSV not found. Skipping FK validation (risk of upload errors).');
    }

    console.log(`\n📂 Reading Lemma File: ${LEMMA_FILE}`);
    const rawData = fs.readFileSync(LEMMA_FILE, 'utf-8');
    const lemmaData = JSON.parse(rawData);
    console.log(`✅ Loaded ${lemmaData.length.toLocaleString()} lemma entries.`);

    const uniqueMap = new Map();
    let skippedInvalidId = 0;

    for (const row of lemmaData) {
        if (!row || !row.variant || row.lemma_id === undefined || row.lemma_id === null) continue;
        
        // FK Validation
        if (validIds.size > 0 && !validIds.has(Number(row.lemma_id))) {
            skippedInvalidId++;
            continue;
        }

        const key = `${row.variant}::${row.lemma_id}`;
        if (!uniqueMap.has(key)) {
            uniqueMap.set(key, row);
        }
    }

    const uniqueBatch = [...uniqueMap.values()];
    console.log(`⚠️ Invalid IDs skipped: ${skippedInvalidId.toLocaleString()}`);
    console.log(`📦 Final Lemma CSV rows: ${uniqueBatch.length.toLocaleString()}`);

    // CSV Headers based on search_index table schema
    // Assuming schema: variant, lemma_id
    // Need to check if there are other columns, but usually just these two for index.
    const headers = ['variant', 'lemma_id'];

    const csvStream = fs.createWriteStream(OUTPUT_LEMMA_CSV, { encoding: 'utf8' });
    
    // Write BOM
    csvStream.write('\ufeff');
    
    // Write header
    csvStream.write(headers.join(',') + '\n');

    for (const row of uniqueBatch) {
        const values = [
            escapeCsvField(row.variant),
            escapeCsvField(row.lemma_id)
        ];
        csvStream.write(values.join(',') + '\n');
    }

    csvStream.end();

    console.log(`✅ Lemma CSV generated at: ${OUTPUT_LEMMA_CSV}`);
}

generateLemmaCsv().catch(console.error);
