const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const path = require('path');

const INPUT_FILE = "C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\kaikki.org-dictionary-German.jsonl";
const OUTPUT_FILE = path.join(__dirname, '../public/dict/search_index.json');
const OUTPUT_GZ = path.join(__dirname, '../public/dict/search_index.json.gz');

async function generateIndex() {
    console.log('🚀 Starting lemma index generation...');
    
    if (!fs.existsSync(INPUT_FILE)) {
        console.error(`❌ Input file not found: ${INPUT_FILE}`);
        process.exit(1);
    }

    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    const index = {};
    let count = 0;
    let variantCount = 0;

    console.log('📖 Reading Kaikki file...');

    for await (const line of rl) {
        try {
            if (!line.trim()) continue;
            const entry = JSON.parse(line);
            
            // We need word and forms
            if (!entry.word) continue;

            const lemma = entry.word;
            
            // Add the lemma itself (normalized)
            const lowerLemma = lemma.toLowerCase();
            // index[lowerLemma] = lemma; // Optional: map lemma to itself? 
            // Usually search_index is for VARIANTS -> LEMMA.
            // But if user types "Gehen", lower is "gehen". 
            // If "gehen" is not in index, findLemma returns null.
            // If findLemma returns null, LibraryView uses "Gehen" (original).
            // So we don't strictly need lemma->lemma mapping if we handle null correctly.
            // But having it ensures we get the correct casing "Gehen" even if user types "gehen".
            // Let's add it.
            if (!index[lowerLemma]) {
                index[lowerLemma] = lemma;
            }

            if (entry.forms && Array.isArray(entry.forms)) {
                for (const form of entry.forms) {
                    if (form.form) {
                        const variant = form.form;
                        const lowerVariant = variant.toLowerCase();
                        
                        // Only add if not already mapped (or overwrite? usually first one is fine)
                        // Also avoid mapping if variant == lemma (redundant but harmless)
                        if (lowerVariant !== lowerLemma) {
                            // If collision (same variant for multiple lemmas), usually pick the most common one.
                            // But here we just pick the first one encountered.
                            if (!index[lowerVariant]) {
                                index[lowerVariant] = lemma;
                                variantCount++;
                            }
                        }
                    }
                }
            }

            count++;
            if (count % 50000 === 0) {
                process.stdout.write(`\rProcessed entries: ${count.toLocaleString()} | Variants: ${variantCount.toLocaleString()}`);
            }
        } catch (e) {
            // Ignore parse errors
        }
    }

    console.log(`\n✅ Parsing complete.`);
    console.log(`   Total entries: ${count.toLocaleString()}`);
    console.log(`   Total variants mapped: ${Object.keys(index).length.toLocaleString()}`);

    // Write JSON
    console.log('✍️ Writing JSON...');
    const jsonString = JSON.stringify(index);
    fs.writeFileSync(OUTPUT_FILE, jsonString);
    const sizeMB = (fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2);
    console.log(`✅ JSON written to ${OUTPUT_FILE} (${sizeMB} MB)`);

    // Write GZIP
    console.log('📦 Compressing to GZIP...');
    const gzip = zlib.createGzip();
    const inp = fs.createReadStream(OUTPUT_FILE);
    const out = fs.createWriteStream(OUTPUT_GZ);

    inp.pipe(gzip).pipe(out);

    out.on('finish', () => {
        const gzSizeMB = (fs.statSync(OUTPUT_GZ).size / 1024 / 1024).toFixed(2);
        console.log(`✅ GZIP written to ${OUTPUT_GZ} (${gzSizeMB} MB)`);
    });
}

generateIndex().catch(console.error);
