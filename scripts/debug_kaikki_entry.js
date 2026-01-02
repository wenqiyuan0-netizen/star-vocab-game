const fs = require('fs');
const readline = require('readline');

const INPUT_FILE = "C:\\Users\\Lenovo\\Downloads\\goethe-pdf-vocab-extractor\\kaikki.org-dictionary-German.jsonl";

async function findWord() {
    const fileStream = fs.createReadStream(INPUT_FILE);
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    for await (const line of rl) {
        if (line.includes('"word": "gehen"')) {
            const entry = JSON.parse(line);
            if (entry.word === 'gehen') {
                if (entry.forms) {
                    console.log(`Found forms: ${entry.forms.length} items`);
                    console.log(JSON.stringify(entry.forms.slice(0, 5), null, 2));
                } else {
                    console.log('No forms field found.');
                    console.log('Keys:', Object.keys(entry));
                }
                return; // Found it, stop
            }
        }
    }
}

findWord();
