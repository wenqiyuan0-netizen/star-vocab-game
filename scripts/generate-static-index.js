const fs = require('fs');
const readline = require('readline');
const zlib = require('zlib');
const path = require('path');

const INPUT_FILE = "C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\supabase_import_index.csv";
const OUTPUT_FILE = path.join(__dirname, '../public/dict/search_index.json');
const OUTPUT_GZ = path.join(__dirname, '../public/dict/search_index.json.gz');

async function convert() {
    console.log('🚀 Starting conversion...');
    
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
    let isHeader = true;

    for await (const line of rl) {
        if (isHeader) {
            isHeader = false;
            continue;
        }

        const parts = line.split(',');
        if (parts.length >= 2) {
            // CSV might have quoted fields, but the simple split works if no commas in variants
            // The sample showed "einer abaxialen", so spaces are fine.
            // If there are commas in variants, this simple split will break. 
            // But usually variants don't have commas.
            // Let's assume last part is ID, rest is variant.
            const lemmaId = parseInt(parts[parts.length - 1], 10);
            const variant = parts.slice(0, parts.length - 1).join(',').trim(); // Re-join in case of commas

            if (variant && !isNaN(lemmaId)) {
                index[variant] = lemmaId;
                count++;
            }
        }
        
        if (count % 100000 === 0) {
            process.stdout.write(`\rProcessed: ${count.toLocaleString()}`);
        }
    }

    console.log(`\n✅ Parsing complete. Total entries: ${count.toLocaleString()}`);

    // Write JSON
    console.log('✍️ Writing JSON...');
    const jsonString = JSON.stringify(index);
    fs.writeFileSync(OUTPUT_FILE, jsonString);
    console.log(`✅ JSON written to ${OUTPUT_FILE} (${(fs.statSync(OUTPUT_FILE).size / 1024 / 1024).toFixed(2)} MB)`);

    // Write GZIP
    console.log('📦 Compressing to GZIP...');
    const gzip = zlib.createGzip();
    const inp = fs.createReadStream(OUTPUT_FILE);
    const out = fs.createWriteStream(OUTPUT_GZ);

    inp.pipe(gzip).pipe(out);

    out.on('finish', () => {
        console.log(`✅ GZIP written to ${OUTPUT_GZ} (${(fs.statSync(OUTPUT_GZ).size / 1024 / 1024).toFixed(2)} MB)`);
        
        // Optional: Remove raw JSON to save space
        // fs.unlinkSync(OUTPUT_FILE);
    });
}

convert().catch(console.error);
