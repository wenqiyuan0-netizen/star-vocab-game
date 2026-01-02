const fs = require('fs');
const path = require('path');

const G_JSON_PATH = path.join(__dirname, '../public/dict/conjugations/g.json');

try {
    const data = JSON.parse(fs.readFileSync(G_JSON_PATH, 'utf8'));
    if (data['gehen']) {
        console.log('✅ Found "gehen" in g.json!');
        console.log(`Entries: ${data['gehen'].length}`);
    } else {
        console.log('❌ "gehen" NOT found in g.json');
        console.log('Sample keys:', Object.keys(data).slice(0, 10));
        
        // Check for case mismatch
        if (data['Gehen']) {
             console.log('⚠️ Found "Gehen" (Capitalized) instead!');
        }
    }
} catch (e) {
    console.error('Error reading g.json:', e);
}
